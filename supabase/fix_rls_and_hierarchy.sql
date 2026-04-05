-- =============================================================================
-- FIX: Simple RLS policies - users of company can see all empresa_usuarios
-- Hierarchy filtering is handled in the frontend
-- =============================================================================

-- 1. Drop old policies
DROP POLICY IF EXISTS hierarquias_select ON hierarquias;
DROP POLICY IF EXISTS hierarquias_insert ON hierarquias;
DROP POLICY IF EXISTS hierarquias_update ON hierarquias;
DROP POLICY IF EXISTS hierarquias_delete ON hierarquias;

DROP POLICY IF EXISTS empresa_usuarios_select ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_insert ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_update ON empresa_usuarios;

-- 2. Helper: check if user belongs to company
CREATE OR REPLACE FUNCTION user_belongs_to_company(p_auth_id uuid, p_empresa_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    JOIN usuarios u ON u.id = eu.usuario_id
    WHERE u.auth_id = p_auth_id
      AND eu.empresa_id = p_empresa_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. hierarquias: users in the company can see
CREATE POLICY hierarquias_select ON hierarquias
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), empresa_id)
  );

CREATE POLICY hierarquias_insert ON hierarquias
  FOR INSERT WITH CHECK (
    user_belongs_to_company(auth.uid(), empresa_id)
  );

CREATE POLICY hierarquias_update ON hierarquias
  FOR UPDATE USING (
    user_belongs_to_company(auth.uid(), empresa_id)
  );

CREATE POLICY hierarquias_delete ON hierarquias
  FOR DELETE USING (
    user_belongs_to_company(auth.uid(), empresa_id)
  );

-- 4. empresa_usuarios: users in the company can see all
CREATE POLICY empresa_usuarios_select ON empresa_usuarios
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), empresa_id)
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = empresa_usuarios.usuario_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY empresa_usuarios_insert ON empresa_usuarios
  FOR INSERT WITH CHECK (
    user_belongs_to_company(auth.uid(), empresa_id)
  );

CREATE POLICY empresa_usuarios_update ON empresa_usuarios
  FOR UPDATE USING (
    user_belongs_to_company(auth.uid(), empresa_id)
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = empresa_usuarios.usuario_id
        AND u.auth_id = auth.uid()
    )
  );
