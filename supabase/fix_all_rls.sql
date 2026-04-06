-- =============================================================================
-- FIX COMPLETO: Limpar TODAS as policies e recriar do zero
-- Resolve conflitos de policies duplicadas e garante master + usuarios normais
-- =============================================================================

-- =====================
-- EMPREASAS
-- =====================
DROP POLICY IF EXISTS empresas_select ON empresas;
DROP POLICY IF EXISTS empresas_insert ON empresas;
DROP POLICY IF EXISTS master_all_read_empresas ON empresas;

CREATE POLICY empresas_select ON empresas FOR SELECT
  USING (
    -- Usuarios que pertencem a empresa OU master
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = empresas.id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY empresas_insert ON empresas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- HIERARQUIAS
-- =====================
DROP POLICY IF EXISTS hierarquias_select ON hierarquias;
DROP POLICY IF EXISTS hierarquias_insert ON hierarquias;
DROP POLICY IF EXISTS hierarquias_update ON hierarquias;
DROP POLICY IF EXISTS hierarquias_delete ON hierarquias;
DROP POLICY IF EXISTS master_all_read_hierarquias ON hierarquias;

CREATE POLICY hierarquias_select ON hierarquias FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = hierarquias.empresa_id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY hierarquias_insert ON hierarquias FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = hierarquias.empresa_id AND u.auth_id = auth.uid())
  );

CREATE POLICY hierarquias_update ON hierarquias FOR UPDATE USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = hierarquias.empresa_id AND u.auth_id = auth.uid())
  );

CREATE POLICY hierarquias_delete ON hierarquias FOR DELETE USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = hierarquias.empresa_id AND u.auth_id = auth.uid())
  );

-- =====================
-- USUARIOS
-- =====================
DROP POLICY IF EXISTS usuarios_select ON usuarios;
DROP POLICY IF EXISTS usuarios_insert ON usuarios;
DROP POLICY IF EXISTS usuarios_update_self ON usuarios;
DROP POLICY IF EXISTS master_all_read_usuarios ON usuarios;

CREATE POLICY usuarios_select ON usuarios FOR SELECT
  USING (
    auth_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- EMPRESA_USUARIOS
-- =====================
DROP POLICY IF EXISTS empresa_usuarios_select ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_insert ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_update ON empresa_usuarios;
DROP POLICY IF EXISTS master_all_read_empresa_usuarios ON empresa_usuarios;

CREATE POLICY empresa_usuarios_select ON empresa_usuarios FOR SELECT
  USING (
    -- Proprio registro
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = empresa_usuarios.usuario_id AND u.auth_id = auth.uid())
    OR
    -- Admin ve todos da empresa
    get_user_hierarquia_ordem(auth.uid(), empresa_usuarios.empresa_id) = 1
    OR
    -- Superiores veem subordinados
    EXISTS (SELECT 1 FROM empresa_usuarios meu JOIN usuarios u ON u.id = meu.usuario_id
            WHERE u.auth_id = auth.uid()
              AND meu.empresa_id = empresa_usuarios.empresa_id
              AND empresa_usuarios.id IN (SELECT get_subordinados(meu.id)))
    OR
    -- Master ve todos
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY empresa_usuarios_insert ON empresa_usuarios FOR INSERT WITH CHECK (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
    OR
    EXISTS (SELECT 1 FROM empresa_usuarios meu JOIN usuarios u ON u.id = meu.usuario_id
            WHERE u.auth_id = auth.uid() AND meu.empresa_id = empresa_usuarios.empresa_id
              AND empresa_usuarios.superior_id = meu.id)
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY empresa_usuarios_update ON empresa_usuarios FOR UPDATE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_usuarios.empresa_id) = 1
    OR
    is_superior_of(auth.uid(), empresa_usuarios.id)
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- =====================
-- CATEGORIAS
-- =====================
DROP POLICY IF EXISTS categorias_select ON categorias;
DROP POLICY IF EXISTS categorias_insert ON categorias;
DROP POLICY IF EXISTS categorias_update ON categorias;
DROP POLICY IF EXISTS categorias_delete ON categorias;
DROP POLICY IF EXISTS master_all_read_categorias ON categorias;

CREATE POLICY categorias_select ON categorias FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = categorias.empresa_id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY categorias_update ON categorias FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY categorias_delete ON categorias FOR DELETE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- =====================
-- PRODUTOS
-- =====================
DROP POLICY IF EXISTS produtos_select ON produtos;
DROP POLICY IF EXISTS produtos_insert ON produtos;
DROP POLICY IF EXISTS produtos_update ON produtos;
DROP POLICY IF EXISTS produtos_delete ON produtos;
DROP POLICY IF EXISTS master_all_read_produtos ON produtos;

CREATE POLICY produtos_select ON produtos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = produtos.empresa_id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY produtos_insert ON produtos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY produtos_update ON produtos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY produtos_delete ON produtos FOR DELETE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- =====================
-- ESTOQUE_MOVIMENTACOES
-- =====================
DROP POLICY IF EXISTS estoque_mov_select ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_insert ON estoque_movimentacoes;
DROP POLICY IF EXISTS master_all_read_estoque ON estoque_movimentacoes;

CREATE POLICY estoque_mov_select ON estoque_movimentacoes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = estoque_movimentacoes.empresa_id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY estoque_mov_insert ON estoque_movimentacoes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- =====================
-- PEDIDOS
-- =====================
DROP POLICY IF EXISTS pedidos_select ON pedidos;
DROP POLICY IF EXISTS pedidos_insert ON pedidos;
DROP POLICY IF EXISTS pedidos_update ON pedidos;
DROP POLICY IF EXISTS master_all_read_pedidos ON pedidos;

CREATE POLICY pedidos_select ON pedidos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = pedidos.usuario_id AND u.auth_id = auth.uid())
    OR
    get_user_hierarquia_ordem(auth.uid(), pedidos.empresa_id) = 1
    OR
    EXISTS (SELECT 1 FROM empresa_usuarios meu JOIN usuarios u ON u.id = meu.usuario_id
            WHERE u.auth_id = auth.uid() AND meu.empresa_id = pedidos.empresa_id
              AND (SELECT eu.id FROM empresa_usuarios eu WHERE eu.usuario_id = pedidos.usuario_id AND eu.empresa_id = pedidos.empresa_id LIMIT 1)
                  IN (SELECT get_subordinados(meu.id)))
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY pedidos_insert ON pedidos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY pedidos_update ON pedidos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = pedidos.usuario_id AND u.auth_id = auth.uid())
    OR
    get_user_hierarquia_ordem(auth.uid(), pedidos.empresa_id) = 1
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

-- =====================
-- PEDIDO_ITENS
-- =====================
DROP POLICY IF EXISTS pedido_itens_select ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_insert ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_update ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_delete ON pedido_itens;
DROP POLICY IF EXISTS master_all_read_pedido_itens ON pedido_itens;

-- pedido_itens depende do pedido pai para visibilidade, então master pode ver tudo
CREATE POLICY pedido_itens_select ON pedido_itens FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id)
    AND
    (
      EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
      OR
      EXISTS (SELECT 1 FROM pedidos p JOIN usuarios pu ON pu.id = p.usuario_id
              WHERE p.id = pedido_itens.pedido_id AND pu.auth_id = auth.uid())
      OR
      get_user_hierarquia_ordem(auth.uid(), (SELECT empresa_id FROM pedidos WHERE id = pedido_itens.pedido_id LIMIT 1)) = 1
    )
  );

CREATE POLICY pedido_itens_insert ON pedido_itens FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY pedido_itens_update ON pedido_itens FOR UPDATE USING (
    EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id)
    AND
    (
      EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
      OR
      EXISTS (SELECT 1 FROM pedidos p JOIN usuarios pu ON pu.id = p.usuario_id
              WHERE p.id = pedido_itens.pedido_id AND pu.auth_id = auth.uid())
    )
  );

CREATE POLICY pedido_itens_delete ON pedido_itens FOR DELETE USING (
    EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id)
    AND
    (
      EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
      OR
      EXISTS (SELECT 1 FROM pedidos p JOIN usuarios pu ON pu.id = p.usuario_id
              WHERE p.id = pedido_itens.pedido_id AND pu.auth_id = auth.uid())
    )
  );

-- =====================
-- CLIENTES
-- =====================
DROP POLICY IF EXISTS clientes_select ON clientes;
DROP POLICY IF EXISTS clientes_insert ON clientes;
DROP POLICY IF EXISTS clientes_update ON clientes;
DROP POLICY IF EXISTS clientes_delete ON clientes;
DROP POLICY IF EXISTS master_all_read_clientes ON clientes;

CREATE POLICY clientes_select ON clientes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
            WHERE eu.empresa_id = clientes.empresa_id AND u.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY clientes_update ON clientes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );

CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_id = auth.uid() AND u.is_master = true)
  );
