-- ============================================================
-- FIX v2: Reseta TODAS as policies das 4 tabelas de pagamento.
-- Execute no Supabase Dashboard -> SQL Editor.
-- ============================================================

-- Dropa qualquer policy existente nas 4 tabelas
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE tablename IN ('condicoes_pagamento','formas_pagamento','cliente_condicoes_pagamento','cliente_formas_pagamento')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Garante RLS habilitado
ALTER TABLE condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_formas_pagamento ENABLE ROW LEVEL SECURITY;

-- ======================================================
-- condicoes_pagamento / formas_pagamento: por empresa
-- ======================================================
CREATE POLICY "cond_pag_all" ON condicoes_pagamento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = condicoes_pagamento.empresa_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = condicoes_pagamento.empresa_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

CREATE POLICY "forma_pag_all" ON formas_pagamento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = formas_pagamento.empresa_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = formas_pagamento.empresa_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- ======================================================
-- cliente_condicoes_pagamento / cliente_formas_pagamento
-- acesso via empresa do cliente
-- ======================================================
CREATE POLICY "cli_cond_all" ON cliente_condicoes_pagamento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE c.id = cliente_condicoes_pagamento.cliente_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c
      JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE c.id = cliente_condicoes_pagamento.cliente_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

CREATE POLICY "cli_forma_all" ON cliente_formas_pagamento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE c.id = cliente_formas_pagamento.cliente_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c
      JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE c.id = cliente_formas_pagamento.cliente_id
        AND u.auth_id = auth.uid()
        AND eu.ativo = true
    )
    OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- Diagnostico: liste as policies ativas apos rodar
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('condicoes_pagamento','formas_pagamento','cliente_condicoes_pagamento','cliente_formas_pagamento');
