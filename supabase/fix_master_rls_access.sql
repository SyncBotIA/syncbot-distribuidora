-- =============================================================================
-- FIX: Master RLS access para todas as tabelas de empresa
-- Permite que usuarios com is_master = true leiam dados de qualquer empresa
-- =============================================================================

-- Drop master policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS master_all_read_empresas ON empresas;
DROP POLICY IF EXISTS master_all_read_hierarquias ON hierarquias;
DROP POLICY IF EXISTS master_all_read_empresa_usuarios ON empresa_usuarios;
DROP POLICY IF EXISTS master_all_read_usuarios ON usuarios;
DROP POLICY IF EXISTS master_all_read_categorias ON categorias;
DROP POLICY IF EXISTS master_all_read_produtos ON produtos;
DROP POLICY IF EXISTS master_all_read_pedidos ON pedidos;
DROP POLICY IF EXISTS master_all_read_pedido_itens ON pedido_itens;
DROP POLICY IF EXISTS master_all_read_estoque ON estoque_movimentacoes;

-- empresas: master ve todas
CREATE POLICY master_all_read_empresas ON empresas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- hierarquias: master ve todas
CREATE POLICY master_all_read_hierarquias ON hierarquias
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- empresa_usuarios: master ve todos
CREATE POLICY master_all_read_empresa_usuarios ON empresa_usuarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- usuarios: master ve todos
CREATE POLICY master_all_read_usuarios ON usuarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- categorias: master ve todas
CREATE POLICY master_all_read_categorias ON categorias
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- produtos: master ve todos
CREATE POLICY master_all_read_produtos ON produtos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- pedidos: master ve todos
CREATE POLICY master_all_read_pedidos ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- pedido_itens: master ve todos
CREATE POLICY master_all_read_pedido_itens ON pedido_itens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- estoque_movimentacoes: master ve todos
CREATE POLICY master_all_read_estoque ON estoque_movimentacoes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );
