-- =============================================================================
-- FIX: Reparo completo do schema para resolver "database error querying schema"
-- Rodar este SQL inteiro de uma vez no SQL Editor do Supabase
-- =============================================================================

-- 1. Garante que todas as colunas existem na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_master boolean DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria boolean DEFAULT false;

-- 2. Garante politica de update no usuarios
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuarios' AND policyname = 'usuarios_update_self'
  ) THEN
    CREATE POLICY usuarios_update_self ON usuarios FOR UPDATE USING (auth_id = auth.uid());
  END IF;
END $$;

-- 3. Cria RPC convidar_usuario_com_auth_id (usada pelo frontend)
CREATE OR REPLACE FUNCTION convidar_usuario_com_auth_id(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_telefone text DEFAULT NULL,
  p_hierarquia_id uuid DEFAULT NULL,
  p_superior_id uuid DEFAULT NULL,
  p_auth_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_usuario_id uuid;
  v_eu_id uuid;
BEGIN
  IF p_auth_id IS NULL THEN
    RAISE EXCEPTION 'Auth ID e obrigatorio';
  END IF;

  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = p_auth_id;

  IF v_usuario_id IS NULL THEN
    INSERT INTO usuarios (auth_id, nome, email, telefone, senha_provisoria)
    VALUES (p_auth_id, p_nome, LOWER(p_email), p_telefone, true)
    RETURNING id INTO v_usuario_id;
  ELSE
    UPDATE usuarios SET senha_provisoria = true WHERE id = v_usuario_id;
  END IF;

  INSERT INTO empresa_usuarios (empresa_id, usuario_id, hierarquia_id, superior_id, ativo)
  VALUES (p_empresa_id, v_usuario_id, p_hierarquia_id, p_superior_id, true)
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET hierarquia_id = p_hierarquia_id, superior_id = p_superior_id, ativo = true
  RETURNING id INTO v_eu_id;

  RETURN v_eu_id;
END;
$$;

-- 4. Garantir que tabela clientes existe e tem FK correta
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes' AND table_schema = 'public') THEN
    CREATE TABLE clientes (
      id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      empresa_id   uuid        NOT NULL REFERENCES empresas (id),
      nome         text        NOT NULL,
      cnpj         text,
      cep          text,
      telefone     text,
      endereco     text,
      bairro       text,
      cidade       text,
      observacao   text,
      vendedor_id  uuid        REFERENCES usuarios (id),
      ativo        boolean     DEFAULT true,
      created_at   timestamptz DEFAULT now()
    );

    CREATE INDEX idx_clientes_empresa_id   ON clientes (empresa_id);
    CREATE INDEX idx_clientes_vendedor_id  ON clientes (vendedor_id);
    ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 5. Garantir coluna cliente_id na tabela pedidos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'cliente_id') THEN
    ALTER TABLE pedidos ADD COLUMN cliente_id uuid REFERENCES clientes (id);
    CREATE INDEX idx_pedidos_cliente_id ON pedidos (cliente_id);
  END IF;
END $$;

-- 6. Garantir coluna comissao_percentual na empresa_usuarios
ALTER TABLE empresa_usuarios ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;

-- 7. Garantir RLS policies para clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'clientes_select') THEN
    CREATE POLICY clientes_select ON clientes FOR SELECT USING (
      EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
       WHERE eu.empresa_id = clientes.empresa_id AND u.auth_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'clientes_insert') THEN
    CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
       WHERE eu.empresa_id = clientes.empresa_id AND u.auth_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'clientes_update') THEN
    CREATE POLICY clientes_update ON clientes FOR UPDATE USING (
      EXISTS (SELECT 1 FROM empresa_usuarios eu JOIN usuarios u ON u.id = eu.usuario_id
       WHERE eu.empresa_id = clientes.empresa_id AND u.auth_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'clientes_delete') THEN
    CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
      get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2));
  END IF;
END $$;

-- 8. Verificar se tudo funciona
SELECT 'OK: usuarios tem todas as colunas' AS status WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'usuarios' AND column_name IN ('is_master', 'senha_provisoria')
  GROUP BY table_name HAVING COUNT(*) >= 2
);

SELECT 'OK: RPC convidar_usuario_com_auth_id existe' AS status WHERE EXISTS (
  SELECT 1 FROM information_schema.routines WHERE routine_name = 'convidar_usuario_com_auth_id'
);

SELECT 'OK: tabela clientes existe' AS status WHERE EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes' AND table_schema = 'public'
);
