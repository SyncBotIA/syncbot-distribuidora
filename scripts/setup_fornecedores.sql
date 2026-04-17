-- ============================================================
-- Script: Sistema de Fornecedores + Vinculo Produto-Fornecedor
--         + Entrada de Estoque com Fornecedor e Nota Fiscal
-- Execute no Supabase Dashboard -> SQL Editor
-- ============================================================

-- ============================================================
-- 1. Tabela fornecedores
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Identificacao
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,

  -- Endereco
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,

  -- Contato
  telefone TEXT,
  celular TEXT,
  email TEXT,
  site TEXT,
  contato_nome TEXT,
  contato_cargo TEXT,

  -- Comercial
  prazo_pagamento_dias INTEGER,
  forma_pagamento TEXT,
  valor_minimo_pedido NUMERIC(10,2),
  prazo_entrega_dias INTEGER,
  condicoes_especiais TEXT,

  -- Bancario
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  chave_pix TEXT,

  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo ON fornecedores(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_social ON fornecedores(razao_social);

-- ============================================================
-- 2. Tabela produto_fornecedores (N:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS produto_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  codigo_no_fornecedor TEXT,
  preco_custo_ultimo NUMERIC(10,2),
  data_ultimo_preco TIMESTAMPTZ,
  prazo_entrega_dias INTEGER,
  quantidade_minima_compra NUMERIC(10,3),
  embalagem TEXT,
  fornecedor_preferencial BOOLEAN DEFAULT false,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(produto_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_fornecedores_produto ON produto_fornecedores(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_fornecedores_fornecedor ON produto_fornecedores(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_produto_fornecedores_codigo ON produto_fornecedores(codigo_no_fornecedor);

-- ============================================================
-- 3. Alteracoes em estoque_movimentacoes
-- ============================================================
ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_nota_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS preco_custo_unitario NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS lote_id UUID;

CREATE INDEX IF NOT EXISTS idx_mov_fornecedor ON estoque_movimentacoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_mov_lote ON estoque_movimentacoes(lote_id);

-- ============================================================
-- 4. Trigger: atualiza preco_custo_ultimo ao registrar entrada
-- ============================================================
CREATE OR REPLACE FUNCTION atualiza_preco_custo_fornecedor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada'
     AND NEW.fornecedor_id IS NOT NULL
     AND NEW.preco_custo_unitario IS NOT NULL
     AND NEW.preco_custo_unitario > 0 THEN
    UPDATE produto_fornecedores
    SET preco_custo_ultimo = NEW.preco_custo_unitario,
        data_ultimo_preco = NEW.created_at
    WHERE produto_id = NEW.produto_id
      AND fornecedor_id = NEW.fornecedor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualiza_preco_custo ON estoque_movimentacoes;
CREATE TRIGGER trg_atualiza_preco_custo
AFTER INSERT ON estoque_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION atualiza_preco_custo_fornecedor();

-- ============================================================
-- 5. RLS - fornecedores
-- ============================================================
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa podem ler fornecedores" ON fornecedores;
CREATE POLICY "Membros da empresa podem ler fornecedores"
  ON fornecedores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      WHERE eu.empresa_id = fornecedores.empresa_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem inserir fornecedores" ON fornecedores;
CREATE POLICY "Membros da empresa podem inserir fornecedores"
  ON fornecedores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      WHERE eu.empresa_id = fornecedores.empresa_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem atualizar fornecedores" ON fornecedores;
CREATE POLICY "Membros da empresa podem atualizar fornecedores"
  ON fornecedores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      WHERE eu.empresa_id = fornecedores.empresa_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem deletar fornecedores" ON fornecedores;
CREATE POLICY "Membros da empresa podem deletar fornecedores"
  ON fornecedores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      WHERE eu.empresa_id = fornecedores.empresa_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- ============================================================
-- 6. RLS - produto_fornecedores
-- ============================================================
ALTER TABLE produto_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa podem ler produto_fornecedores" ON produto_fornecedores;
CREATE POLICY "Membros da empresa podem ler produto_fornecedores"
  ON produto_fornecedores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM produtos p
      JOIN empresa_usuarios eu ON eu.empresa_id = p.empresa_id
      WHERE p.id = produto_fornecedores.produto_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem inserir produto_fornecedores" ON produto_fornecedores;
CREATE POLICY "Membros da empresa podem inserir produto_fornecedores"
  ON produto_fornecedores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM produtos p
      JOIN empresa_usuarios eu ON eu.empresa_id = p.empresa_id
      WHERE p.id = produto_fornecedores.produto_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem atualizar produto_fornecedores" ON produto_fornecedores;
CREATE POLICY "Membros da empresa podem atualizar produto_fornecedores"
  ON produto_fornecedores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM produtos p
      JOIN empresa_usuarios eu ON eu.empresa_id = p.empresa_id
      WHERE p.id = produto_fornecedores.produto_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

DROP POLICY IF EXISTS "Membros da empresa podem deletar produto_fornecedores" ON produto_fornecedores;
CREATE POLICY "Membros da empresa podem deletar produto_fornecedores"
  ON produto_fornecedores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM produtos p
      JOIN empresa_usuarios eu ON eu.empresa_id = p.empresa_id
      WHERE p.id = produto_fornecedores.produto_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- ============================================================
-- 7. Seed de permissoes novas para hierarquias existentes
-- ============================================================
DO $$
DECLARE
  h RECORD;
  admin_perms TEXT[] := ARRAY[
    'fornecedores.ver','fornecedores.criar','fornecedores.editar','fornecedores.excluir',
    'fornecedores.importar','fornecedores.vincular_produtos',
    'produtos.vincular_fornecedores',
    'estoque.importar_planilha'
  ];
  gerente_perms TEXT[] := ARRAY[
    'fornecedores.ver','fornecedores.criar','fornecedores.editar',
    'fornecedores.importar','fornecedores.vincular_produtos',
    'produtos.vincular_fornecedores',
    'estoque.importar_planilha'
  ];
  p TEXT;
BEGIN
  FOR h IN SELECT id, nome FROM hierarquias LOOP
    IF lower(h.nome) LIKE '%admin%' THEN
      FOREACH p IN ARRAY admin_perms LOOP
        INSERT INTO hierarquia_permissoes (hierarquia_id, permissao)
        VALUES (h.id, p)
        ON CONFLICT (hierarquia_id, permissao) DO NOTHING;
      END LOOP;
    ELSIF lower(h.nome) LIKE '%gerente%' THEN
      FOREACH p IN ARRAY gerente_perms LOOP
        INSERT INTO hierarquia_permissoes (hierarquia_id, permissao)
        VALUES (h.id, p)
        ON CONFLICT (hierarquia_id, permissao) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 8. Recarregar schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Pronto! Fornecedores, vinculos e entrada em lote configurados.
-- ============================================================
