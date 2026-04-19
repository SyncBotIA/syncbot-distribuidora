-- ============================================================
-- Script: Condicoes e Formas de Pagamento + vinculo com Clientes
-- Execute no Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Condicoes de pagamento (cadastro por empresa)
CREATE TABLE IF NOT EXISTS condicoes_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_condicoes_pagamento_empresa_ativo ON condicoes_pagamento(empresa_id, ativo);

-- 2. Formas de pagamento (cadastro por empresa)
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_empresa_ativo ON formas_pagamento(empresa_id, ativo);

-- 3. Vinculo N:N Cliente <-> Condicao
CREATE TABLE IF NOT EXISTS cliente_condicoes_pagamento (
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  condicao_pagamento_id UUID NOT NULL REFERENCES condicoes_pagamento(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, condicao_pagamento_id)
);
CREATE INDEX IF NOT EXISTS idx_cli_cond_cliente ON cliente_condicoes_pagamento(cliente_id);

-- 4. Vinculo N:N Cliente <-> Forma
CREATE TABLE IF NOT EXISTS cliente_formas_pagamento (
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, forma_pagamento_id)
);
CREATE INDEX IF NOT EXISTS idx_cli_forma_cliente ON cliente_formas_pagamento(cliente_id);

-- 5. Campos novos em pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS condicao_pagamento_id UUID REFERENCES condicoes_pagamento(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS forma_pagamento_id UUID REFERENCES formas_pagamento(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS emite_nota_fiscal BOOLEAN DEFAULT false;

-- 6. RLS
ALTER TABLE condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_formas_pagamento ENABLE ROW LEVEL SECURITY;

-- Policies corretas vivem em fix_pagamento_rls.sql (rodar apos este)
