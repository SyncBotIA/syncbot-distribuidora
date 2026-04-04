-- RPC: listar_todas_empresas (para o Painel Master)
CREATE OR REPLACE FUNCTION listar_todas_empresas(p_master_id uuid)
RETURNS TABLE(id uuid, nome text, cnpj text, created_at timestamptz, total_usuarios bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar se é master
  IF NOT (SELECT u.is_master FROM usuarios u WHERE u.id = p_master_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é master';
  END IF;

  RETURN QUERY
    SELECT e.id, e.nome, e.cnpj, e.created_at,
           COALESCE((SELECT COUNT(*) FROM empresa_usuarios eu WHERE eu.empresa_id = e.id AND eu.ativo = true), 0) as total_usuarios
    FROM empresas e
    ORDER BY e.nome;
END;
$$;

-- RPC: vincular_usuario_empresa
CREATE OR REPLACE FUNCTION vincular_usuario_empresa(
  p_master_id uuid,
  p_email text,
  p_empresa_id uuid,
  p_hierarquia_ordem integer
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_usuario_id uuid;
  v_hierarquia_id uuid;
  v_existing uuid;
BEGIN
  -- Verificar se é master
  IF NOT (SELECT u.is_master FROM usuarios u WHERE u.id = p_master_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é master';
  END IF;

  -- Buscar usuário pelo email
  SELECT u.id INTO v_usuario_id FROM usuarios u WHERE LOWER(u.email) = LOWER(p_email);
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email "%" não encontrado. Ele precisa criar uma conta primeiro.', p_email;
  END IF;

  -- Buscar hierarquia pela ordem
  SELECT h.id INTO v_hierarquia_id FROM hierarquias h
  WHERE h.empresa_id = p_empresa_id AND h.ordem = p_hierarquia_ordem;
  IF v_hierarquia_id IS NULL THEN
    RAISE EXCEPTION 'Hierarquia com ordem % não encontrada nesta empresa', p_hierarquia_ordem;
  END IF;

  -- Verificar se já está vinculado
  SELECT eu.id INTO v_existing FROM empresa_usuarios eu
  WHERE eu.empresa_id = p_empresa_id AND eu.usuario_id = v_usuario_id;

  IF v_existing IS NOT NULL THEN
    -- Atualizar vínculo existente
    UPDATE empresa_usuarios SET hierarquia_id = v_hierarquia_id, ativo = true
    WHERE id = v_existing;
    RETURN 'Usuário atualizado com sucesso';
  ELSE
    -- Criar novo vínculo
    INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, ativo)
    VALUES (p_empresa_id, v_usuario_id, v_hierarquia_id, true);
    RETURN 'Usuário vinculado com sucesso';
  END IF;
END;
$$;

-- RPC: desvincular_usuario_empresa
CREATE OR REPLACE FUNCTION desvincular_usuario_empresa(
  p_master_id uuid,
  p_empresa_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar se é master
  IF NOT (SELECT u.is_master FROM usuarios u WHERE u.id = p_master_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é master';
  END IF;

  DELETE FROM empresa_usuarios WHERE id = p_empresa_usuario_id;
END;
$$;
