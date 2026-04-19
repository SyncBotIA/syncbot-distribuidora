-- ============================================================
-- FIX: RLS das tabelas de pagamento
-- Execute no Supabase Dashboard -> SQL Editor
-- ============================================================

-- Dropar policies antigas (erradas)
DROP POLICY IF EXISTS "cond_pag_acesso_empresa" ON condicoes_pagamento;
DROP POLICY IF EXISTS "forma_pag_acesso_empresa" ON formas_pagamento;
DROP POLICY IF EXISTS "cli_cond_pag_acesso" ON cliente_condicoes_pagamento;
DROP POLICY IF EXISTS "cli_forma_pag_acesso" ON cliente_formas_pagamento;

-- ============================================================
-- condicoes_pagamento
-- ============================================================
CREATE POLICY "cond_pag_select" ON condicoes_pagamento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = condicoes_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cond_pag_insert" ON condicoes_pagamento FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = condicoes_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cond_pag_update" ON condicoes_pagamento FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = condicoes_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cond_pag_delete" ON condicoes_pagamento FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = condicoes_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

-- ============================================================
-- formas_pagamento
-- ============================================================
CREATE POLICY "forma_pag_select" ON formas_pagamento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = formas_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "forma_pag_insert" ON formas_pagamento FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = formas_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "forma_pag_update" ON formas_pagamento FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = formas_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "forma_pag_delete" ON formas_pagamento FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_id = formas_pagamento.empresa_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

-- ============================================================
-- cliente_condicoes_pagamento
-- ============================================================
CREATE POLICY "cli_cond_select" ON cliente_condicoes_pagamento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_condicoes_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cli_cond_insert" ON cliente_condicoes_pagamento FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_condicoes_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cli_cond_delete" ON cliente_condicoes_pagamento FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_condicoes_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

-- ============================================================
-- cliente_formas_pagamento
-- ============================================================
CREATE POLICY "cli_forma_select" ON cliente_formas_pagamento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_formas_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cli_forma_insert" ON cliente_formas_pagamento FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_formas_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);

CREATE POLICY "cli_forma_delete" ON cliente_formas_pagamento FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
    WHERE c.id = cliente_formas_pagamento.cliente_id
      AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
      AND eu.ativo = true
  )
  OR EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
);
