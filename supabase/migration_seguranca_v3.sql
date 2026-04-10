-- =============================================================================
-- SEGURANÇA v3 - Sistema de Gestão de Distribuidora
-- Migration definitiva: corrige ordem, cria funções de role por nome,
-- e aplica RLS granular por cargo (master > admin > gerente > vendedor)
-- =============================================================================

-- =============================================================================
-- PASSO 1: Corrigir valores de ordem na tabela hierarquias
-- Convenção: 1 = admin (mais alto), 2 = gerente, 3 = vendedor (mais baixo)
-- =============================================================================
UPDATE hierarquias SET ordem = 1 WHERE LOWER(nome) LIKE '%admin%';
UPDATE hierarquias SET ordem = 2 WHERE LOWER(nome) LIKE '%gerente%';
UPDATE hierarquias SET ordem = 3 WHERE LOWER(nome) LIKE '%vendedor%';

-- =============================================================================
-- PASSO 2: Drop TODAS as policies existentes (limpeza total)
-- =============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- PASSO 3: Ativar RLS em todas as tabelas
-- =============================================================================
ALTER TABLE empresas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hierarquias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PASSO 4: Funções helper de segurança
-- =============================================================================

-- fn_is_master: verifica se o usuário logado é master
CREATE OR REPLACE FUNCTION fn_is_master() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- fn_user_belongs_to_company: verifica se o usuário pertence à empresa
CREATE OR REPLACE FUNCTION fn_user_belongs_to_company(p_empresa_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    JOIN usuarios u ON u.id = eu.usuario_id
    WHERE eu.empresa_id = p_empresa_id
      AND u.auth_id = auth.uid()
      AND eu.ativo = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- fn_user_role_in_company: retorna o nome da hierarquia do usuário na empresa
CREATE OR REPLACE FUNCTION fn_user_role_in_company(p_empresa_id uuid) RETURNS text AS $$
  SELECT LOWER(h.nome) FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE eu.empresa_id = p_empresa_id
    AND u.auth_id = auth.uid()
    AND eu.ativo = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- fn_is_admin_or_above: master OU admin na empresa
CREATE OR REPLACE FUNCTION fn_is_admin_or_above(p_empresa_id uuid) RETURNS boolean AS $$
  SELECT fn_is_master() OR fn_user_role_in_company(p_empresa_id) LIKE '%admin%';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- fn_is_gerente_or_above: master OU admin OU gerente na empresa
CREATE OR REPLACE FUNCTION fn_is_gerente_or_above(p_empresa_id uuid) RETURNS boolean AS $$
  SELECT fn_is_master()
    OR fn_user_role_in_company(p_empresa_id) LIKE '%admin%'
    OR fn_user_role_in_company(p_empresa_id) LIKE '%gerente%';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Manter funções existentes para compatibilidade
CREATE OR REPLACE FUNCTION get_subordinados(p_empresa_usuario_id uuid)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE sub AS (
    SELECT id FROM empresa_usuarios WHERE superior_id = p_empresa_usuario_id AND ativo = true
    UNION ALL
    SELECT eu.id FROM empresa_usuarios eu JOIN sub s ON eu.superior_id = s.id WHERE eu.ativo = true
  ) SELECT id FROM sub;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_hierarquia_ordem(p_auth_id uuid, p_empresa_id uuid)
RETURNS integer AS $$
DECLARE v_ordem integer;
BEGIN
  SELECT h.ordem INTO v_ordem FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id AND eu.empresa_id = p_empresa_id AND eu.ativo = true
  LIMIT 1;
  RETURN v_ordem;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superior_of(p_auth_id uuid, p_target_empresa_usuario_id uuid)
RETURNS boolean AS $$
DECLARE v_id uuid;
BEGIN
  SELECT eu.id INTO v_id FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = (SELECT empresa_id FROM empresa_usuarios WHERE id = p_target_empresa_usuario_id)
    AND eu.ativo = true
  LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM get_subordinados(v_id) s WHERE s = p_target_empresa_usuario_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- PASSO 5: Policies por tabela
-- Regras:
--   SELECT: master vê tudo | membros veem dados da sua empresa
--   INSERT: depende da tabela (admin/gerente/membro)
--   UPDATE: depende da tabela
--   DELETE: depende da tabela (geralmente admin+)
-- =============================================================================

-- ========================
-- EMPRESAS
-- ========================
-- SELECT: master OU membro
CREATE POLICY empresas_select ON empresas FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(id)
);
-- INSERT: apenas master (criar empresa é operação master)
CREATE POLICY empresas_insert ON empresas FOR INSERT WITH CHECK (
  fn_is_master()
);
-- UPDATE: master ou admin da empresa
CREATE POLICY empresas_update ON empresas FOR UPDATE USING (
  fn_is_admin_or_above(id)
);
-- DELETE: apenas master
CREATE POLICY empresas_delete ON empresas FOR DELETE USING (
  fn_is_master()
);

-- ========================
-- USUARIOS
-- ========================
-- SELECT: master vê todos | usuário vê a si mesmo | membros da mesma empresa veem colegas
CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (
  fn_is_master()
  OR auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM empresa_usuarios eu1
    JOIN empresa_usuarios eu2 ON eu1.empresa_id = eu2.empresa_id
    JOIN usuarios u ON u.id = eu1.usuario_id
    WHERE eu2.usuario_id = usuarios.id AND u.auth_id = auth.uid() AND eu1.ativo = true
  )
);
-- INSERT: qualquer autenticado (necessário para cadastro / convite)
CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
-- UPDATE: master OU próprio usuário
CREATE POLICY usuarios_update ON usuarios FOR UPDATE USING (
  fn_is_master()
  OR auth_id = auth.uid()
);

-- ========================
-- HIERARQUIAS
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY hierarquias_select ON hierarquias FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT/UPDATE/DELETE: apenas admin+
CREATE POLICY hierarquias_insert ON hierarquias FOR INSERT WITH CHECK (
  fn_is_admin_or_above(empresa_id)
);
CREATE POLICY hierarquias_update ON hierarquias FOR UPDATE USING (
  fn_is_admin_or_above(empresa_id)
);
CREATE POLICY hierarquias_delete ON hierarquias FOR DELETE USING (
  fn_is_admin_or_above(empresa_id)
);

-- ========================
-- EMPRESA_USUARIOS
-- ========================
-- SELECT: master OU membros da mesma empresa
CREATE POLICY empresa_usuarios_select ON empresa_usuarios FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT: admin+ (adicionar usuários à empresa)
CREATE POLICY empresa_usuarios_insert ON empresa_usuarios FOR INSERT WITH CHECK (
  fn_is_admin_or_above(empresa_id)
);
-- UPDATE: admin+ OU superior do alvo OU próprio registro (dados pessoais)
CREATE POLICY empresa_usuarios_update ON empresa_usuarios FOR UPDATE USING (
  fn_is_admin_or_above(empresa_id)
  OR is_superior_of(auth.uid(), id)
  OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = empresa_usuarios.usuario_id AND u.auth_id = auth.uid())
);
-- DELETE: admin+
CREATE POLICY empresa_usuarios_delete ON empresa_usuarios FOR DELETE USING (
  fn_is_admin_or_above(empresa_id)
);

-- ========================
-- CATEGORIAS
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY categorias_select ON categorias FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT/UPDATE/DELETE: gerente+
CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (
  fn_is_gerente_or_above(empresa_id)
);
CREATE POLICY categorias_update ON categorias FOR UPDATE USING (
  fn_is_gerente_or_above(empresa_id)
);
CREATE POLICY categorias_delete ON categorias FOR DELETE USING (
  fn_is_gerente_or_above(empresa_id)
);

-- ========================
-- PRODUTOS
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY produtos_select ON produtos FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT/UPDATE: gerente+
CREATE POLICY produtos_insert ON produtos FOR INSERT WITH CHECK (
  fn_is_gerente_or_above(empresa_id)
);
CREATE POLICY produtos_update ON produtos FOR UPDATE USING (
  fn_is_gerente_or_above(empresa_id)
);
-- DELETE: admin+
CREATE POLICY produtos_delete ON produtos FOR DELETE USING (
  fn_is_admin_or_above(empresa_id)
);

-- ========================
-- ESTOQUE_MOVIMENTACOES
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY estoque_mov_select ON estoque_movimentacoes FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT: gerente+ (movimentar estoque)
CREATE POLICY estoque_mov_insert ON estoque_movimentacoes FOR INSERT WITH CHECK (
  fn_is_gerente_or_above(empresa_id)
);

-- ========================
-- PEDIDOS
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY pedidos_select ON pedidos FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT: qualquer membro da empresa (vendedor pode criar pedido)
CREATE POLICY pedidos_insert ON pedidos FOR INSERT WITH CHECK (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- UPDATE: admin+ OU dono do pedido
CREATE POLICY pedidos_update ON pedidos FOR UPDATE USING (
  fn_is_admin_or_above(empresa_id)
  OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = pedidos.usuario_id AND u.auth_id = auth.uid())
);
-- DELETE: admin+
CREATE POLICY pedidos_delete ON pedidos FOR DELETE USING (
  fn_is_admin_or_above(empresa_id)
);

-- ========================
-- PEDIDO_ITENS
-- ========================
-- SELECT: quem pode ver o pedido pai
CREATE POLICY pedido_itens_select ON pedido_itens FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id
    AND (fn_is_master() OR fn_user_belongs_to_company(p.empresa_id))
  )
);
-- INSERT: quem pode criar/editar o pedido pai
CREATE POLICY pedido_itens_insert ON pedido_itens FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id
    AND (
      fn_is_master()
      OR fn_is_admin_or_above(p.empresa_id)
      OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.usuario_id AND u.auth_id = auth.uid())
    )
  )
);
-- UPDATE: dono do pedido OU admin+
CREATE POLICY pedido_itens_update ON pedido_itens FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id
    AND (
      fn_is_master()
      OR fn_is_admin_or_above(p.empresa_id)
      OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.usuario_id AND u.auth_id = auth.uid())
    )
  )
);
-- DELETE: dono do pedido OU admin+
CREATE POLICY pedido_itens_delete ON pedido_itens FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id
    AND (
      fn_is_master()
      OR fn_is_admin_or_above(p.empresa_id)
      OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.usuario_id AND u.auth_id = auth.uid())
    )
  )
);

-- ========================
-- CLIENTES
-- ========================
-- SELECT: master OU membros da empresa
CREATE POLICY clientes_select ON clientes FOR SELECT USING (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- INSERT: qualquer membro (vendedor pode cadastrar cliente)
CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
  fn_is_master()
  OR fn_user_belongs_to_company(empresa_id)
);
-- UPDATE: gerente+ OU vendedor dono do cliente
CREATE POLICY clientes_update ON clientes FOR UPDATE USING (
  fn_is_gerente_or_above(empresa_id)
  OR EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    JOIN usuarios u ON u.id = eu.usuario_id
    WHERE eu.id = clientes.vendedor_id AND u.auth_id = auth.uid()
  )
);
-- DELETE: admin+
CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
  fn_is_admin_or_above(empresa_id)
);

-- =============================================================================
-- PASSO 6: Reload PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';
