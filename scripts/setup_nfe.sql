-- ============================================================
-- Script para funcionalidade de NF-e
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Colunas de NF-e na tabela pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nfe_id TEXT DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nfe_status TEXT DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nfe_numero INTEGER DEFAULT NULL;

-- 2. Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Pronto!
-- ============================================================
