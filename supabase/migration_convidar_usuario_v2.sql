-- =============================================================================
-- Migration: convidar_usuario_v2
-- Cria usuario AUTOMAGICAMENTE no auth.users (sem signUp no frontend),
-- evitando problemas com confirmacao de email do Supabase.
-- Tudo server-side com SECURITY DEFINER.
--
-- O que faz:
--   1. Verifica se email ja existe (auth.users E usuarios)
--   2. Inserir diretamente em auth.users com email_confirmed_at = NOW()
--   3. Insere na tabela usuarios (app)
--   4. Vincula a empresa via empresa_usuarios
--   5. Retorna JSON com todos os IDs gerados
--
-- PREREQUISITOS:
--   - Extensao pgcrypto habilitada (padrao do Supabase)
--   - Tabelas 'usuarios' e 'empresa_usuarios' ja existentes
--
-- APLICAR: Copie e cole no SQL Editor do Supabase Dashboard.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- RPC: convidar_usuario_v2
-- Cria auth user + usuarios entry + empresa_usuarios link em uma so chamada.
-- Bypass email confirmation via email_confirmed_at = NOW().
-- Retorna jsonb com auth_id, usuario_id, empresa_usuario_id, email, senha_provisoria.
-- =============================================================================

DROP FUNCTION IF EXISTS convidar_usuario_v2(uuid, text, text, text, text, uuid, uuid);

CREATE OR REPLACE FUNCTION convidar_usuario_v2(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_telefone text DEFAULT NULL,
  p_hierarquia_id uuid DEFAULT NULL,
  p_superior_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_id uuid;
  v_usuario_id uuid;
  v_eu_id uuid;
  v_normalized_email text;
  v_temp_password text := '123456';
BEGIN
  -- Normalizar email
  v_normalized_email := LOWER(TRIM(p_email));

  -- Validar inputs
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa ID e obrigatorio';
  END IF;

  IF p_nome IS NULL OR TRIM(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome e obrigatorio';
  END IF;

  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RAISE EXCEPTION 'Email e obrigatorio';
  END IF;

  IF p_hierarquia_id IS NULL THEN
    RAISE EXCEPTION 'Hierarquia e obrigatoria';
  END IF;

  -- Verificar duplicata por email em auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_normalized_email) THEN
    -- Se ja existe, auto-confirmar caso nao esteja confirmado
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()), updated_at = NOW()
    WHERE email = v_normalized_email AND email_confirmed_at IS NULL;

    v_auth_id := (SELECT id FROM auth.users WHERE email = v_normalized_email LIMIT 1);

    -- Se ja existe na tabela usuarios tambem, apenas atualizar e re-ativar
    SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = v_auth_id;

    IF v_usuario_id IS NOT NULL THEN
      UPDATE usuarios SET senha_provisoria = true WHERE id = v_usuario_id;

      INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id, ativo)
      VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id, true)
      ON CONFLICT (empresa_id, usuario_id)
      DO UPDATE SET hierarquia_id = p_hierarquia_id, superior_id = p_superior_id, ativo = true
      RETURNING id INTO v_eu_id;

      RETURN jsonb_build_object(
        'empresa_usuario_id', v_eu_id,
        'usuario_id', v_usuario_id,
        'auth_id', v_auth_id,
        'email', v_normalized_email,
        'senha_provisoria', v_temp_password,
        'reutilizado', true
      );
    END IF;

    -- Existe no auth mas nao na tabela usuarios: criar a entrada
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (v_auth_id, p_nome, v_normalized_email, p_telefone, true)
    RETURNING id INTO v_usuario_id;
  ELSE
    -- Usuario novo: criar no auth.users
    v_auth_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_sent_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_id,
      'authenticated',
      'authenticated',
      v_normalized_email,
      crypt(v_temp_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', p_nome),
      NOW(),
      NOW(),
      NOW()
    );

    -- Criar entrada na tabela usuarios
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (v_auth_id, p_nome, v_normalized_email, p_telefone, true)
    RETURNING id INTO v_usuario_id;
  END IF;

  -- Vincular usuario a empresa
  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id, ativo)
  VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id, true)
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    hierarquia_id = p_hierarquia_id,
    superior_id = p_superior_id,
    ativo = true
  RETURNING id INTO v_eu_id;

  RETURN jsonb_build_object(
    'empresa_usuario_id', v_eu_id,
    'usuario_id', v_usuario_id,
    'auth_id', v_auth_id,
    'email', v_normalized_email,
    'senha_provisoria', v_temp_password,
    'reutilizado', false
  );
END;
$$;

-- Permissoes
GRANT EXECUTE ON FUNCTION convidar_usuario_v2(uuid, text, text, text, uuid, uuid) TO authenticated;
