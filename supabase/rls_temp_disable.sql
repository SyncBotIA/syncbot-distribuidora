-- Desabilitar RLS temporariamente para voltar a funcionar
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
