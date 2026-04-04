-- =============================================================================
-- Migration: convidar_usuario_v2
-- Cria usuario AUTOMAGICAMENTE no auth.users (sem signUp no frontend),
-- evitando problemas com confirmacao de email do Supabase.
-- Tudo server-side com SECURITY DEFINER.
-- =============================================================================

-- Garantir extensao pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- RPC: convidar_usuario_v2
-- Cria auth user + usuarios entry + empresa_usuarios link em uma so chamada.
-- Bypass email confirmation via email_confirmed_at = NOW().
-- =============================================================================
CREATE OR REPLACE FUNCTION convidar_usuario_v2(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_senha text DEFAULT '123456',
  p_telefone text DEFAULT NULL,
  p_hierarquia_id uuid DEFAULT NULL,
  p_superior_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_id uuid;
  v_usuario_id uuid;
  v_eu_id uuid;
BEGIN
  -- Verificar duplicata por email em auth.users
  SELECT id INTO v_auth_id FROM auth.users WHERE email = LOWER(p_email);

  IF v_auth_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe um usuario com o email %', p_email;
  END IF;

  -- Verificar duplicata por email na tabela usuarios (app-level)
  SELECT id INTO v_usuario_id FROM usuarios WHERE LOWER(email) = LOWER(p_email);

  IF v_usuario_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe um usuario cadastrado com o email %', p_email;
  END IF;

  -- Gerar novo UUID para o auth user
  v_auth_id := gen_random_uuid();

  -- Inserir diretamente no auth.users com email ja confirmado
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
    LOWER(p_email),
    crypt(p_senha, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    NOW(),
    NOW(),
    NOW()
  );

  -- Criar entrada na tabela usuarios com senha_provisoria = true
  INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
  VALUES (v_auth_id, p_nome, LOWER(p_email), p_telefone, true)
  RETURNING id INTO v_usuario_id;

  -- Vincular usuario a empresa
  INSERT INTO empresa_usuarios (
    empresa_id,
    usuario_id,
    hierarquia_id,
    superior_id,
    ativo
  ) VALUES (
    p_empresa_id,
    v_usuario_id,
    p_hierarquia_id,
    p_superior_id,
    true
  )
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    hierarquia_id = p_hierarquia_id,
    superior_id = p_superior_id,
    ativo = true
  RETURNING id INTO v_eu_id;

  RETURN v_eu_id;
END;
$$;
