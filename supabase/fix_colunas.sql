-- FIX: Adicionar colunas faltantes que o frontend espera

-- empresa_usuarios - comissao_percentual
ALTER TABLE empresa_usuarios ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;

-- pedidos - cliente_id
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);

-- FIX: Verificar relacionamento empresa_usuarios -> usuarios
-- Se a FK nao estiver apontando corretamente, recriar

DO $$
BEGIN
  -- Checar se existe uma FK em empresa_usuarios.usuario_id -> usuarios.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'empresa_usuarios'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'usuario_id'
      AND tc.constraint_name NOT LIKE '%_superior_id_fkey'
  ) THEN
    ALTER TABLE empresa_usuarios
      ADD CONSTRAINT empresa_usuarios_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
  END IF;

  -- Checar FK hierarquias
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'empresa_usuarios'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'hierarquia_id'
  ) THEN
    ALTER TABLE empresa_usuarios
      ADD CONSTRAINT empresa_usuarios_hierarquia_id_fkey
      FOREIGN KEY (hierarquia_id) REFERENCES hierarquias(id);
  END IF;
END $$;

-- Forcar Supabase a recarregar schema
NOTIFY pgrst, 'reload schema';
