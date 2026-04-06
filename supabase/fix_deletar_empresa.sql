CREATE OR REPLACE FUNCTION deletar_empresa(
  p_empresa_id uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_is_master boolean;
BEGIN
  -- Verificar se é master
  SELECT is_master INTO v_is_master FROM usuarios WHERE id = p_usuario_id;

  IF NOT v_is_master THEN
    RAISE EXCEPTION 'Acesso negado: apenas master pode excluir empresas';
  END IF;

  -- Deletar em cascata
  DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_id = p_empresa_id);
  DELETE FROM pedidos WHERE empresa_id = p_empresa_id;
  DELETE FROM estoque_movimentacoes WHERE empresa_id = p_empresa_id;
  DELETE FROM produtos WHERE empresa_id = p_empresa_id;
  DELETE FROM categorias WHERE empresa_id = p_empresa_id;
  DELETE FROM empresa_usuarios WHERE empresa_id = p_empresa_id;
  DELETE FROM hierarquias WHERE empresa_id = p_empresa_id;
  DELETE FROM clientes WHERE empresa_id = p_empresa_id;
  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;
