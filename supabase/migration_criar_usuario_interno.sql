-- =============================================================================
-- RPC: criar_usuario_interno (Versao 2 - mais simples, sem auth.users directo)
-- Usa auth.users como tabela normal (supabase geralmente permite via SECURITY DEFINER)
-- =============================================================================

-- Passo 1: Garantir extensao pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Passo 2: Criar a funcao
DO $$
BEGIN
  EXECUTE 'CREATE OR REPLACE FUNCTION criar_usuario_interno(
    p_empresa_id uuid,
    p_nome text,
    p_email text,
    p_senha text DEFAULT ''123456'',
    p_telefone text DEFAULT NULL,
    p_hierarquia_id uuid DEFAULT NULL,
    p_superior_id uuid DEFAULT NULL
  )
  RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER AS $func$
  DECLARE
    v_auth_id uuid;
    v_usuario_id uuid;
    v_eu_id uuid;
  BEGIN
    -- Verificar se ja existe
    SELECT id INTO v_auth_id FROM auth.users WHERE email = LOWER(p_email);

    IF v_auth_id IS NULL THEN
      -- Inserir no auth.users com email ja confirmado
      v_auth_id := auth.uid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        ''00000000-0000-0000-0000-000000000000'',
        gen_random_uuid(),
        ''authenticated'', ''authenticated'',
        LOWER(p_email),
        crypt(p_senha, gen_salt(''bf'')), NOW(),
        ''{"provider":"email","providers":["email"]}''::jsonb,
        jsonb_build_object(''nome'', p_nome),
        NOW(), NOW()
      ) RETURNING id INTO v_auth_id;

      IF v_auth_id IS NULL THEN
        RAISE EXCEPTION ''Nao foi possivel criar usuario %'', p_email;
      END IF;
    ELSE
      RAISE EXCEPTION ''Usuario com email % ja existe'', p_email;
    END IF;

    -- Criar na tabela usuarios
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (v_auth_id, p_nome, LOWER(p_email), p_telefone, true)
    RETURNING id INTO v_usuario_id;

    -- Vincular a empresa
    INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id, ativo)
    VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id, true)
    RETURNING id INTO v_eu_id;

    RETURN v_eu_id;
  END;
  $func$;';
END $$;
