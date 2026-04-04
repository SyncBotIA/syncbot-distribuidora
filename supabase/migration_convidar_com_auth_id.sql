-- =============================================================================
-- RPC: convidar_usuario_com_auth_id
-- Vincula usuario a empresa recebendo auth_id diretamente (sem buscar auth.users)
-- Usa SECURITY DEFINER para ignorar RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION convidar_usuario_com_auth_id(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_telefone text DEFAULT NULL,
  p_hierarquia_id uuid DEFAULT NULL,
  p_superior_id uuid DEFAULT NULL,
  p_auth_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_usuario_id uuid;
  v_eu_id uuid;
BEGIN
  IF p_auth_id IS NULL THEN
    RAISE EXCEPTION 'Auth ID e obrigatorio';
  END IF;

  -- Criar ou buscar na tabela usuarios
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = p_auth_id;

  IF v_usuario_id IS NULL THEN
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (p_auth_id, p_nome, LOWER(p_email), p_telefone, true)
    RETURNING id INTO v_usuario_id;
  ELSE
    UPDATE usuarios SET senha_provisoria = true WHERE id = v_usuario_id;
  END IF;

  -- Vincular a empresa
  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id, ativo)
  VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id, true)
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET hierarquia_id = p_hierarquia_id, superior_id = p_superior_id, ativo = true
  RETURNING id INTO v_eu_id;

  RETURN v_eu_id;
END;
$$;
