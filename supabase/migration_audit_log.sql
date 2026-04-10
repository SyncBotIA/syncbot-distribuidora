-- =============================================================================
-- AUDIT LOG - Rastreamento de todas as operações no sistema
-- =============================================================================

-- 1. Tabela de audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  operacao text NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  registro_id uuid,
  empresa_id uuid,
  usuario_auth_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_log_empresa_id ON audit_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_auth_id);

-- 3. Função genérica de trigger
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_empresa_id uuid;
  v_registro_id uuid;
  v_old jsonb := NULL;
  v_new jsonb := NULL;
BEGIN
  -- Capturar dados
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_registro_id := OLD.id;
  ELSE
    v_new := to_jsonb(NEW);
    v_registro_id := NEW.id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
  END IF;

  -- Extrair empresa_id se existir na row
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_empresa_id := OLD.empresa_id;
    ELSE
      v_empresa_id := NEW.empresa_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    v_empresa_id := NULL;
  END;

  -- Inserir log
  INSERT INTO audit_log (tabela, operacao, registro_id, empresa_id, usuario_auth_id, dados_anteriores, dados_novos)
  VALUES (TG_TABLE_NAME, TG_OP, v_registro_id, v_empresa_id, auth.uid(), v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach triggers nas tabelas principais
DROP TRIGGER IF EXISTS audit_pedidos ON pedidos;
CREATE TRIGGER audit_pedidos AFTER INSERT OR UPDATE OR DELETE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_produtos ON produtos;
CREATE TRIGGER audit_produtos AFTER INSERT OR UPDATE OR DELETE ON produtos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_clientes ON clientes;
CREATE TRIGGER audit_clientes AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_empresa_usuarios ON empresa_usuarios;
CREATE TRIGGER audit_empresa_usuarios AFTER INSERT OR UPDATE OR DELETE ON empresa_usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_estoque ON estoque_movimentacoes;
CREATE TRIGGER audit_estoque AFTER INSERT OR UPDATE OR DELETE ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_hierarquias ON hierarquias;
CREATE TRIGGER audit_hierarquias AFTER INSERT OR UPDATE OR DELETE ON hierarquias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- 5. RLS no audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
  fn_is_master()
  OR (empresa_id IS NOT NULL AND fn_is_admin_or_above(empresa_id))
);

DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (true);

-- 6. Função de limpeza (logs > 90 dias)
CREATE OR REPLACE FUNCTION fn_cleanup_audit_log(dias integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM audit_log WHERE created_at < now() - (dias || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
