-- ============================================================
-- Script completo para funcionalidade de Entregador
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabela pedido_entregadores (vínculo pedido ↔ entregador)
-- ============================================================
CREATE TABLE IF NOT EXISTS pedido_entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pedido_id, usuario_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedido_entregadores_pedido ON pedido_entregadores(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_entregadores_usuario ON pedido_entregadores(usuario_id);

-- RLS
ALTER TABLE pedido_entregadores ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ler
CREATE POLICY "Usuarios autenticados podem ler pedido_entregadores"
  ON pedido_entregadores FOR SELECT
  TO authenticated
  USING (true);

-- Policy: usuários autenticados podem inserir
CREATE POLICY "Usuarios autenticados podem inserir pedido_entregadores"
  ON pedido_entregadores FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: usuários autenticados podem deletar
CREATE POLICY "Usuarios autenticados podem deletar pedido_entregadores"
  ON pedido_entregadores FOR DELETE
  TO authenticated
  USING (true);

-- 2. Coluna comprovante_url na tabela pedidos
-- ============================================================
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprovante_url TEXT DEFAULT NULL;

-- 3. Habilitar Replication para pedido_entregadores (Realtime)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pedido_entregadores;

-- 4. Storage bucket para comprovantes de entrega
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('entregas', 'entregas', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: usuários autenticados podem fazer upload
CREATE POLICY "Autenticados podem fazer upload entregas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'entregas');

-- Policy: qualquer um pode visualizar (bucket público)
CREATE POLICY "Publico pode visualizar entregas"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'entregas');

-- Policy: usuários autenticados podem deletar seus uploads
CREATE POLICY "Autenticados podem deletar entregas"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'entregas');

-- ============================================================
-- Pronto! Todas as estruturas foram criadas.
-- ============================================================
