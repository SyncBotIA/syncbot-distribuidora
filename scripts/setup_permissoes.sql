-- ============================================================
-- Script: Sistema de Permissoes Dinamicas
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Criar tabela hierarquia_permissoes
CREATE TABLE IF NOT EXISTS hierarquia_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarquia_id UUID NOT NULL REFERENCES hierarquias(id) ON DELETE CASCADE,
  permissao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hierarquia_id, permissao)
);

CREATE INDEX IF NOT EXISTS idx_hierarquia_permissoes_hierarquia
  ON hierarquia_permissoes(hierarquia_id);

-- 2. RLS
ALTER TABLE hierarquia_permissoes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro da empresa pode ler
CREATE POLICY "Membros da empresa podem ler permissoes"
  ON hierarquia_permissoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hierarquias h
      JOIN empresa_usuarios eu ON eu.empresa_id = h.empresa_id
      WHERE h.id = hierarquia_permissoes.hierarquia_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
    )
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- INSERT: apenas admin da empresa ou master
CREATE POLICY "Admin pode inserir permissoes"
  ON hierarquia_permissoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hierarquias h
      JOIN empresa_usuarios eu ON eu.empresa_id = h.empresa_id
      JOIN hierarquias h2 ON h2.id = eu.hierarquia_id
      WHERE h.id = hierarquia_permissoes.hierarquia_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
        AND lower(h2.nome) LIKE '%admin%'
    )
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- DELETE: apenas admin da empresa ou master
CREATE POLICY "Admin pode remover permissoes"
  ON hierarquia_permissoes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM hierarquias h
      JOIN empresa_usuarios eu ON eu.empresa_id = h.empresa_id
      JOIN hierarquias h2 ON h2.id = eu.hierarquia_id
      WHERE h.id = hierarquia_permissoes.hierarquia_id
        AND eu.usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        AND eu.ativo = true
        AND lower(h2.nome) LIKE '%admin%'
    )
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND is_master = true)
  );

-- 3. Seed: permissoes padrao para hierarquias existentes
DO $$
DECLARE
  h RECORD;
  perms TEXT[];
  p TEXT;
  all_perms TEXT[] := ARRAY[
    'dashboard.ver','dashboard.ranking','dashboard.estoque_critico',
    'pedidos.ver','pedidos.ver_todos','pedidos.criar','pedidos.editar','pedidos.cancelar',
    'pedidos.confirmar','pedidos.marcar_entregue','pedidos.atribuir_vendedor',
    'pedidos.atribuir_entregador','pedidos.gerar_nfe','pedidos.baixar_csv',
    'produtos.ver','produtos.criar','produtos.editar','produtos.excluir','produtos.gerenciar_categorias',
    'estoque.ver','estoque.movimentar','estoque.historico',
    'clientes.ver','clientes.criar','clientes.editar','clientes.excluir',
    'clientes.atribuir_vendedor','clientes.baixar_csv',
    'usuarios.ver','usuarios.criar','usuarios.editar','usuarios.excluir',
    'entregas.ver','entregas.confirmar'
  ];
  gerente_perms TEXT[] := ARRAY[
    'dashboard.ver','dashboard.ranking','dashboard.estoque_critico',
    'pedidos.ver','pedidos.ver_todos','pedidos.criar','pedidos.editar','pedidos.cancelar',
    'pedidos.confirmar','pedidos.marcar_entregue','pedidos.atribuir_vendedor',
    'pedidos.atribuir_entregador','pedidos.gerar_nfe','pedidos.baixar_csv',
    'produtos.ver','produtos.criar','produtos.editar','produtos.excluir','produtos.gerenciar_categorias',
    'estoque.ver','estoque.movimentar','estoque.historico',
    'clientes.ver','clientes.criar','clientes.editar','clientes.excluir',
    'clientes.atribuir_vendedor','clientes.baixar_csv',
    'usuarios.ver',
    'entregas.ver','entregas.confirmar'
  ];
  entregador_perms TEXT[] := ARRAY[
    'dashboard.ver','entregas.ver','entregas.confirmar'
  ];
  vendedor_perms TEXT[] := ARRAY[
    'dashboard.ver',
    'pedidos.ver','pedidos.criar','pedidos.editar',
    'produtos.ver',
    'clientes.ver','clientes.criar','clientes.editar',
    'entregas.ver'
  ];
BEGIN
  FOR h IN SELECT id, nome FROM hierarquias LOOP
    -- Determinar permissoes baseado no nome
    IF lower(h.nome) LIKE '%admin%' THEN
      perms := all_perms;
    ELSIF lower(h.nome) LIKE '%gerente%' THEN
      perms := gerente_perms;
    ELSIF lower(h.nome) LIKE '%entregador%' THEN
      perms := entregador_perms;
    ELSE
      perms := vendedor_perms;
    END IF;

    -- Inserir permissoes (ignorar duplicatas)
    FOREACH p IN ARRAY perms LOOP
      INSERT INTO hierarquia_permissoes (hierarquia_id, permissao)
      VALUES (h.id, p)
      ON CONFLICT (hierarquia_id, permissao) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 4. Recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Pronto! Permissoes padrao foram criadas para todas as hierarquias.
-- ============================================================
