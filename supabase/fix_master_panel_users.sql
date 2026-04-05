-- =============================================================================
-- RPC: master_listar_usuarios_empresa
-- Retorna todos os usuarios + hierarquia de uma empresa, ignorando RLS
-- para uso no Painel Master
-- =============================================================================
CREATE OR REPLACE FUNCTION master_listar_usuarios_empresa(
  p_empresa_id uuid
)
RETURNS TABLE(
  eu_id uuid,
  usuario_id uuid,
  ativo boolean,
  usuario_nome text,
  usuario_email text,
  usuario_telefone text,
  hierarquia_id uuid,
  hierarquia_nome text,
  hierarquia_ordem integer
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT eu.id, eu.usuario_id, eu.ativo,
         u.nome, u.email, u.telefone,
         h.id, h.nome, h.ordem
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE eu.empresa_id = p_empresa_id
  ORDER BY h.ordem, u.nome;
END;
$$;
