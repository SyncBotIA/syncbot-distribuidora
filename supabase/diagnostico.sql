-- Diagnóstico: verificar estado atual das tabelas
-- Execute e me mostre os resultados

-- 1. Colunas da tabela empresa_usuarios
SELECT column_name, data_type, is_nullable, is_identity
FROM information_schema.columns
WHERE table_name = 'empresa_usuarios'
ORDER BY ordinal_position;

-- 2. Colunas da tabela usuarios
SELECT column_name, data_type, is_nullable, is_identity
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- 3. Foreign keys de empresa_usuarios
SELECT tc.constraint_name, tc.constraint_type,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'empresa_usuarios'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 4. RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('empresas', 'hierarquias', 'usuarios', 'empresa_usuarios',
                     'categorias', 'produtos', 'estoque_movimentacoes', 'pedidos',
                     'pedido_itens', 'clientes');

-- 5. policies ativas
SELECT tablename, policyname, cmd
FROM pg_policies
ORDER BY tablename, policyname;
