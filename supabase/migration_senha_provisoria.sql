-- =============================================================================
-- Migration: Senha Provisoria
-- Adiciona suporte a senha provisoria com redefinicao obrigatoria no primeiro login
-- =============================================================================

-- 1. Adicionar colunas na tabela usuarios (se nao existirem)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_master boolean DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria boolean DEFAULT false;

-- 2. Policy para permitir UPDATE do proprio usuario (para redefinir senha_provisoria)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuarios' AND policyname = 'usuarios_update_self'
  ) THEN
    CREATE POLICY usuarios_update_self ON usuarios
      FOR UPDATE USING (auth_id = auth.uid());
  END IF;
END $$;

-- =============================================================================
-- RPC: convidar_usuario
-- Cria um usuario via Supabase Auth e vincula a empresa com hierarquia
-- Senha provisoria = true (usuario obrigado a redefinir no primeiro login)
-- =============================================================================
CREATE OR REPLACE FUNCTION convidar_usuario(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_senha text,
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
  -- Criar usuario no Supabase Auth
  v_auth_id := (
    SELECT id FROM auth.users WHERE email = LOWER(p_email)
  );

  IF v_auth_id IS NULL THEN
    -- Criar no auth.users via extensao
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, confirmation_token,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      LOWER(p_email), crypt(p_senha, gen_salt('bf')),
      now(), now(), now(), '',
      '{"provider":"email","providers":["email"]}',
      '{}'
    )
    RETURNING id INTO v_auth_id;
  END IF;

  -- Criar ou buscar na tabela usuarios
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = v_auth_id;

  IF v_usuario_id IS NULL THEN
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (v_auth_id, p_nome, LOWER(p_email), p_telefone, true)
    RETURNING id INTO v_usuario_id;
  ELSE
    -- Se ja existe, marcar senha como provisoria
    UPDATE usuarios SET senha_provisoria = true WHERE id = v_usuario_id;
  END IF;

  -- Vincular a empresa
  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id)
  VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id)
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET hierarquia_id = p_hierarquia_id, superior_id = p_superior_id, ativo = true
  RETURNING id INTO v_eu_id;

  RETURN v_eu_id;
END;
$$;

-- =============================================================================
-- RPC: criar_empresa_com_gerente
-- Master cria empresa + gerente (com senha provisoria)
-- =============================================================================
CREATE OR REPLACE FUNCTION criar_empresa_com_gerente(
  p_nome text,
  p_cnpj text,
  p_master_id uuid,
  p_gerente_email text,
  p_gerente_senha text,
  p_gerente_nome text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id uuid;
  v_hierarquia_id uuid;
  v_auth_id uuid;
  v_usuario_id uuid;
BEGIN
  -- Verificar se e master
  IF NOT (SELECT u.is_master FROM usuarios u WHERE u.id = p_master_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuario nao e master';
  END IF;

  -- Verificar CNPJ duplicado
  IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM empresas WHERE cnpj = p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ ja cadastrado';
  END IF;

  -- Criar empresa
  INSERT INTO empresas (nome, cnpj) VALUES (p_nome, p_cnpj)
  RETURNING id INTO v_empresa_id;

  -- Criar hierarquia padrao (Gerente = ordem 1)
  INSERT INTO hierarquias (empresa_id, nome, ordem, descricao)
  VALUES (v_empresa_id, 'Gerente', 1, 'Gerente da empresa')
  RETURNING id INTO v_hierarquia_id;

  -- Criar ou buscar usuario auth
  SELECT id INTO v_auth_id FROM auth.users WHERE email = LOWER(p_gerente_email);

  IF v_auth_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, confirmation_token,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      LOWER(p_gerente_email), crypt(p_gerente_senha, gen_salt('bf')),
      now(), now(), now(), '',
      '{"provider":"email","providers":["email"]}',
      '{}'
    )
    RETURNING id INTO v_auth_id;
  END IF;

  -- Criar ou buscar na tabela usuarios
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = v_auth_id;

  IF v_usuario_id IS NULL THEN
    INSERT INTO usuarios (auth_id, nome, email, senha_provisoria)
    VALUES (v_auth_id, p_gerente_nome, LOWER(p_gerente_email), true)
    RETURNING id INTO v_usuario_id;
  ELSE
    UPDATE usuarios SET senha_provisoria = true WHERE id = v_usuario_id;
  END IF;

  -- Vincular gerente a empresa
  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id)
  VALUES (v_empresa_id, v_usuario_id, v_hierarquia_id);

  RETURN v_empresa_id;
END;
$$;

-- =============================================================================
-- RPC: criar_empresa_completa
-- Usuario comum cria empresa para si mesmo (sem senha provisoria)
-- =============================================================================
CREATE OR REPLACE FUNCTION criar_empresa_completa(
  p_nome text,
  p_cnpj text,
  p_usuario_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id uuid;
  v_hierarquia_id uuid;
BEGIN
  -- Verificar CNPJ duplicado
  IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM empresas WHERE cnpj = p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ ja cadastrado';
  END IF;

  -- Criar empresa
  INSERT INTO empresas (nome, cnpj) VALUES (p_nome, p_cnpj)
  RETURNING id INTO v_empresa_id;

  -- Criar hierarquia padrao
  INSERT INTO hierarquias (empresa_id, nome, ordem, descricao)
  VALUES (v_empresa_id, 'Gerente', 1, 'Gerente da empresa')
  RETURNING id INTO v_hierarquia_id;

  -- Vincular usuario como gerente
  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id)
  VALUES (v_empresa_id, p_usuario_id, v_hierarquia_id);

  RETURN v_empresa_id;
END;
$$;

-- =============================================================================
-- RPC: excluir_usuario_empresa
-- Remove usuario de uma empresa (desativa vinculo)
-- =============================================================================
CREATE OR REPLACE FUNCTION excluir_usuario_empresa(
  p_quem_exclui_id uuid,
  p_empresa_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM empresa_usuarios WHERE id = p_empresa_usuario_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Vinculo nao encontrado';
  END IF;

  UPDATE empresa_usuarios SET ativo = false WHERE id = p_empresa_usuario_id;
END;
$$;
