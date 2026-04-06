-- =============================================================================
-- RLS SEGURO v2 - Sistema de Gestão de Distribuidora
-- Master SEMPRE acessa tudo, membros veem dados da sua empresa
-- =============================================================================

-- 1. Drop TODAS as policies existentes
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

DROP POLICY IF EXISTS empresas_delete ON empresas;
DROP POLICY IF EXISTS empresas_insert ON empresas;
DROP POLICY IF EXISTS empresas_select ON empresas;
DROP POLICY IF EXISTS empresas_update ON empresas;

DROP POLICY IF EXISTS estoque_mov_delete ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_insert ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_select ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_mov_update ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_delete ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_insert ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_select ON estoque_movimentacoes;
DROP POLICY IF EXISTS estoque_movimentacoes_update ON estoque_movimentacoes;

DROP POLICY IF EXISTS hierarquias_delete ON hierarquias;
DROP POLICY IF EXISTS hierarquias_insert ON hierarquias;
DROP POLICY IF EXISTS hierarquias_select ON hierarquias;
DROP POLICY IF EXISTS hierarquias_update ON hierarquias;

DROP POLICY IF EXISTS pedido_itens_delete ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_insert ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_select ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_update ON pedido_itens;

DROP POLICY IF EXISTS pedidos_delete ON pedidos;
DROP POLICY IF EXISTS pedidos_insert ON pedidos;
DROP POLICY IF EXISTS pedidos_select ON pedidos;
DROP POLICY IF EXISTS pedidos_update ON pedidos;

DROP POLICY IF EXISTS produtos_delete ON produtos;
DROP POLICY IF EXISTS produtos_insert ON produtos;
DROP POLICY IF EXISTS produtos_select ON produtos;
DROP POLICY IF EXISTS produtos_update ON produtos;

DROP POLICY IF EXISTS usuarios_delete ON usuarios;
DROP POLICY IF EXISTS usuarios_insert ON usuarios;
DROP POLICY IF EXISTS usuarios_select ON usuarios;
DROP POLICY IF EXISTS usuarios_update ON usuarios;
DROP POLICY IF EXISTS usuarios_update_self ON usuarios;

-- Drop master policies antigas
DROP POLICY IF EXISTS master_all_read_categorias ON categorias;
DROP POLICY IF EXISTS master_all_read_empresa_usuarios ON empresa_usuarios;
DROP POLICY IF EXISTS master_all_read_empresas ON empresas;
DROP POLICY IF EXISTS master_all_read_estoque ON estoque_movimentacoes;
DROP POLICY IF EXISTS master_all_read_hierarquias ON hierarquias;
DROP POLICY IF EXISTS master_all_read_pedido_itens ON pedido_itens;
DROP POLICY IF EXISTS master_all_read_pedidos ON pedidos;
DROP POLICY IF EXISTS master_all_read_produtos ON produtos;
DROP POLICY IF EXISTS master_all_read_usuarios ON usuarios;
DROP POLICY IF EXISTS master_all_read_clientes ON clientes;

-- 2. Garantir estrutura
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_master boolean DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria boolean DEFAULT false;
ALTER TABLE empresa_usuarios ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  nome text NOT NULL, cnpj text, telefone text,
  endereco text, bairro text, cidade text, cep text,
  observacao text, vendedor_id uuid REFERENCES empresa_usuarios(id),
  ativo boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_id ON clientes (vendedor_id);

-- 3. Funções
CREATE OR REPLACE FUNCTION get_subordinados(p_empresa_usuario_id uuid)
RETURNS SETOF uuid AS $$ BEGIN RETURN QUERY
  WITH RECURSIVE sub AS (
    SELECT id FROM empresa_usuarios WHERE superior_id = p_empresa_usuario_id
    UNION ALL
    SELECT eu.id FROM empresa_usuarios eu JOIN sub s ON eu.superior_id = s.id
  ) SELECT id FROM sub;
END; $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_hierarquia_ordem(p_auth_id uuid, p_empresa_id uuid)
RETURNS integer AS $$ DECLARE v_ordem integer;
BEGIN
  SELECT h.ordem INTO v_ordem FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id AND eu.empresa_id = p_empresa_id LIMIT 1;
  RETURN v_ordem; END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superior_of(p_auth_id uuid, p_target_empresa_usuario_id uuid)
RETURNS boolean AS $$ DECLARE v_id uuid; BEGIN
  SELECT eu.id INTO v_id FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = (SELECT empresa_id FROM empresa_usuarios WHERE id = p_target_empresa_usuario_id) LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM get_subordinados(v_id) s WHERE s = p_target_empresa_usuario_id); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper: qualquer usuario logado que seja master
CREATE OR REPLACE FUNCTION fn_is_master() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Ativar RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hierarquias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 5. Policies: master pode tudo | membros veem sua empresa

-- EMPRESAS
CREATE POLICY empresas_select ON empresas FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = empresas.id AND u.auth_id = auth.uid())
);
CREATE POLICY empresas_insert ON empresas FOR INSERT WITH CHECK (
  fn_is_master() OR auth.uid() IS NOT NULL
);
CREATE POLICY empresas_update ON empresas FOR UPDATE USING (fn_is_master());
CREATE POLICY empresas_delete ON empresas FOR DELETE USING (fn_is_master());

-- USUARIOS
CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (
  fn_is_master()
  OR auth_id = auth.uid()
);
CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY usuarios_update ON usuarios FOR UPDATE USING (
  fn_is_master()
  OR auth_id = auth.uid()
);

-- HIERARQUIAS
CREATE POLICY hierarquias_select ON hierarquias FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = hierarquias.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY hierarquias_insert ON hierarquias FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY hierarquias_update ON hierarquias FOR UPDATE USING (fn_is_master());
CREATE POLICY hierarquias_delete ON hierarquias FOR DELETE USING (fn_is_master());

-- EMPRESA_USUARIOS
CREATE POLICY empresa_usuarios_select ON empresa_usuarios FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = empresa_usuarios.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY empresa_usuarios_insert ON empresa_usuarios FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY empresa_usuarios_update ON empresa_usuarios FOR UPDATE USING (fn_is_master());
CREATE POLICY empresa_usuarios_delete ON empresa_usuarios FOR DELETE USING (fn_is_master());

-- CATEGORIAS
CREATE POLICY categorias_select ON categorias FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = categorias.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY categorias_update ON categorias FOR UPDATE USING (fn_is_master());
CREATE POLICY categorias_delete ON categorias FOR DELETE USING (fn_is_master());

-- PRODUTOS
CREATE POLICY produtos_select ON produtos FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = produtos.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY produtos_insert ON produtos FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY produtos_update ON produtos FOR UPDATE USING (fn_is_master());
CREATE POLICY produtos_delete ON produtos FOR DELETE USING (fn_is_master());

-- ESTOQUE
CREATE POLICY estoque_movimentacoes_select ON estoque_movimentacoes FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = estoque_movimentacoes.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY estoque_movimentacoes_insert ON estoque_movimentacoes FOR INSERT WITH CHECK (fn_is_master());

-- PEDIDOS
CREATE POLICY pedidos_select ON pedidos FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = pedidos.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY pedidos_insert ON pedidos FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY pedidos_update ON pedidos FOR UPDATE USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = pedidos.usuario_id AND u.auth_id = auth.uid())
);

-- PEDIDO_ITENS
CREATE POLICY pedido_itens_select ON pedido_itens FOR SELECT USING (
  EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND (
    fn_is_master()
    OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.usuario_id AND u.auth_id = auth.uid())
  ))
);
CREATE POLICY pedido_itens_insert ON pedido_itens FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY pedido_itens_update ON pedido_itens FOR UPDATE USING (fn_is_master());
CREATE POLICY pedido_itens_delete ON pedido_itens FOR DELETE USING (fn_is_master());

-- CLIENTES
CREATE POLICY clientes_select ON clientes FOR SELECT USING (
  fn_is_master()
  OR EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id WHERE eu.empresa_id = clientes.empresa_id AND u.auth_id = auth.uid())
);
CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (fn_is_master());
CREATE POLICY clientes_update ON clientes FOR UPDATE USING (fn_is_master());
CREATE POLICY clientes_delete ON clientes FOR DELETE USING (fn_is_master());

-- 6. Reload
NOTIFY pgrst, 'reload schema';
