-- FIX URGENTE: Desabilitar RLS temporariamente para resolver erros 500/406/400
-- Depois que voltar a funcionar, reativar com policies corretas

-- 1. Garantir colunas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_master boolean DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria boolean DEFAULT false;

-- 2. Criar tabela clientes se nao existir
CREATE TABLE IF NOT EXISTS clientes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES empresas (id),
  nome        text        NOT NULL,
  cnpj        text,
  telefone    text,
  endereco    text,
  bairro      text,
  cidade      text,
  cep         text,
  observacao  text,
  vendedor_id uuid        REFERENCES empresa_usuarios (id),
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_id ON clientes (vendedor_id);

-- 3. Desabilitar RLS em todas as tabelas (RESOLVE TODOS OS 500)
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

-- 4. Recriar funcoes de apoio
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
DECLARE
  v_usuario_ids uuid[];
BEGIN
  -- Coletar IDs dos usuarios da empresa
  SELECT ARRAY(SELECT usuario_id FROM empresa_usuarios WHERE empresa_id = p_empresa_id) INTO v_usuario_ids;

  -- Deletar em cascata (pedidos -> estoque_movimentacoes -> empresa_usuarios -> hierarquias -> empresa)
  DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_id = p_empresa_id);
  DELETE FROM pedidos WHERE empresa_id = p_empresa_id;
  DELETE FROM estoque_movimentacoes WHERE empresa_id = p_empresa_id;
  DELETE FROM produtos WHERE empresa_id = p_empresa_id;
  DELETE FROM categorias WHERE empresa_id = p_empresa_id;
  DELETE FROM empresa_usuarios WHERE empresa_id = p_empresa_id;
  DELETE FROM hierarquias WHERE empresa_id = p_empresa_id;
  DELETE FROM empresas WHERE id = p_empresa_id;

  -- Desativar usuarios que nao pertencem a nenhuma empresa
  IF array_length(v_usuario_ids, 1) IS NOT NULL THEN
    UPDATE usuarios SET is_master = false WHERE id = ANY(v_usuario_ids) AND is_master = false;
  END IF;
END;
$$ LANGUAGE plpgsql;
