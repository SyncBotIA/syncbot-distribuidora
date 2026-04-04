-- =============================================================================
-- RPC: criar_usuario_interno
-- Cria usuario via auth.users (permitido via SECURITY DEFINER+set_config)
-- =============================================================================

-- Passo 1: Garantir extensao pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Passo 2: Criar a funcao
CREATE OR REPLACE FUNCTION criar_usuario_interno(
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
  -- Verificar se ja existe na tabela app
  SELECT u.id INTO v_auth_id
  FROM usuarios u
  JOIN auth.users au ON au.id = u.auth_id
  WHERE LOWER(au.email) = LOWER(p_email);

  IF v_auth_id IS NOT NULL THEN
    RAISE EXCEPTION 'Usuario com email % ja existe', p_email;
  END IF;

  -- Gerar novo UUID
  v_auth_id := gen_random_uuid();

  -- Inserir no auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_sent_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    'authenticated', 'authenticated',
    LOWER(p_email),
    crypt(p_senha, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    NOW(), NOW(),
    NOW()
  );

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
$$;
