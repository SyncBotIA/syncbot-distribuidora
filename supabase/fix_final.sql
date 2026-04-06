-- FIX FINAL: Drop TODAS as policies de TODAS as tabelas
-- Depois reativar RLS com 1 policy OPEN por tabela

-- 1- Drop TODAS as policies existentes
DROP POLICY IF EXISTS categorias_delete ON categorias;
DROP POLICY IF EXISTS categorias_insert ON categorias;
DROP POLICY IF EXISTS categorias_select ON categorias;
DROP POLICY IF EXISTS categorias_update ON categorias;

DROP POLICY IF EXISTS clientes_delete ON clientes;
DROP POLICY IF EXISTS clientes_insert ON clientes;
DROP POLICY IF EXISTS clientes_select ON clientes;
DROP POLICY IF EXISTS clientes_update ON clientes;

DROP POLICY IF EXISTS empresa_usuarios_delete ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_insert ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_select ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_update ON empresa_usuarios;
DROP POLICY IF EXISTS master_all_read_empresa_usuarios ON empresa_usuarios;

DROP POLICY IF EXISTS empresas_delete ON empresas;
DROP POLICY IF EXISTS empresas_insert ON empresas;
DROP POLICY IF EXISTS empresas_select ON empresas;
DROP POLICY IF EXISTS empresas_update ON empresas;
DROP POLICY IF EXISTS master_all_read_empresas ON empresas;

DROP POLICY IF EXISTS estoque_mov_delete ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_insert ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_select ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_update ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_delete ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_insert ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_select ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_update ON estoque_movimentacoes;
DROP POLICY IF EXISTS master_all_read_estoque ON estoque_movimentacoes;

DROP POLICY IF EXISTS hierarquias_delete ON hierarquias;
DROP POLICY IF EXISTS hierarquias_insert ON hierarquias;
DROP POLICY IF EXISTS hierarquias_select ON hierarquias;
DROP POLICY IF EXISTS hierarquias_update ON hierarquias;
DROP POLICY IF EXISTS master_all_read_hierarquias ON hierarquias;

DROP POLICY IF EXISTS pedido_itens_delete ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_insert ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_select ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_update ON pedido_itens;
DROP POLICY IF EXISTS master_all_read_pedido_itens ON pedido_itens;

DROP POLICY IF EXISTS pedidos_delete ON pedidos;
DROP POLICY IF EXISTS pedidos_insert ON pedidos;
DROP POLICY IF EXISTS pedidos_select ON pedidos;
DROP POLICY IF EXISTS pedidos_update ON pedidos;
DROP POLICY IF EXISTS master_all_read_pedidos ON pedidos;

DROP POLICY IF EXISTS produtos_delete ON produtos;
DROP POLICY IF EXISTS produtos_insert ON produtos;
DROP POLICY IF EXISTS produtos_select ON produtos;
DROP POLICY IF EXISTS produtos_update ON produtos;
DROP POLICY IF EXISTS master_all_read_produtos ON produtos;

DROP POLICY IF EXISTS usuarios_delete ON usuarios;
DROP POLICY IF EXISTS usuarios_insert ON usuarios;
DROP POLICY IF EXISTS usuarios_select ON usuarios;
DROP POLICY IF EXISTS usuarios_update ON usuarios;
DROP POLICY IF EXISTS usuarios_update_self ON usuarios;
DROP POLICY IF EXISTS master_all_read_usuarios ON usuarios;

-- 2- Forcar desabilitar RLS
ALTER TABLE empresas               DISABLE ROW LEVEL SECURITY;
ALTER TABLE hierarquias            DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios               DISABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_usuarios       DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtos               DISABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos                DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens           DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               DISABLE ROW LEVEL SECURITY;

-- 3- Colunas faltantes
ALTER TABLE empresa_usuarios ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);

-- 4- Recriar funcoes
CREATE OR REPLACE FUNCTION get_subordinados(p_empresa_usuario_id uuid)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinados AS (
    SELECT eu.id FROM empresa_usuarios eu WHERE eu.superior_id = p_empresa_usuario_id
    UNION ALL
    SELECT eu.id FROM empresa_usuarios eu
    INNER JOIN subordinados s ON eu.superior_id = s.id
  )
  SELECT id FROM subordinados;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_user_hierarquia_ordem(p_auth_id uuid, p_empresa_id uuid)
RETURNS integer AS $$
DECLARE v_ordem integer;
BEGIN
  SELECT h.ordem INTO v_ordem
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id AND eu.empresa_id = p_empresa_id
  LIMIT 1;
  RETURN v_ordem;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_superior_of(p_auth_id uuid, p_target_empresa_usuario_id uuid)
RETURNS boolean AS $$
DECLARE v_empresa_usuario_id uuid;
BEGIN
  SELECT eu.id INTO v_empresa_usuario_id
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = (SELECT empresa_id FROM empresa_usuarios WHERE id = p_target_empresa_usuario_id)
  LIMIT 1;
  IF v_empresa_usuario_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM get_subordinados(v_empresa_usuario_id) sub_id WHERE sub_id = p_target_empresa_usuario_id);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION deletar_empresa(p_empresa_id uuid, p_usuario_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_id = p_empresa_id);
  DELETE FROM pedidos WHERE empresa_id = p_empresa_id;
  DELETE FROM estoque_movimentacoes WHERE empresa_id = p_empresa_id;
  DELETE FROM produtos WHERE empresa_id = p_empresa_id;
  DELETE FROM categorias WHERE empresa_id = p_empresa_id;
  DELETE FROM empresa_usuarios WHERE empresa_id = p_empresa_id;
  DELETE FROM hierarquias WHERE empresa_id = p_empresa_id;
  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$ LANGUAGE plpgsql;

-- 5- Reload schema do PostgREST
NOTIFY pgrst, 'reload schema';
