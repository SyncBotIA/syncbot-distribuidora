-- =============================================================================
-- FIX: Restore ORIGINAL RLS policies (as they were before our changes broke them)
-- =============================================================================

-- 1. Drop any custom policies we may have created
DROP POLICY IF EXISTS hierarquias_select ON hierarquias;
DROP POLICY IF EXISTS hierarquias_insert ON hierarquias;
DROP POLICY IF EXISTS hierarquias_update ON hierarquias;
DROP POLICY IF EXISTS hierarquias_delete ON hierarquias;
DROP POLICY IF EXISTS empresa_usuarios_select ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_insert ON empresa_usuarios;
DROP POLICY IF EXISTS empresa_usuarios_update ON empresa_usuarios;
DROP POLICY IF EXISTS usuarios_select ON usuarios;
DROP POLICY IF EXISTS usuarios_insert ON usuarios;

-- 2. Helper: get hierarchy ordem by user's auth_id and empresa_id
CREATE OR REPLACE FUNCTION get_user_hierarquia_ordem_fixed(p_auth_id uuid, p_empresa_id uuid)
RETURNS integer AS $$
DECLARE
  v_ordem integer;
BEGIN
  SELECT h.ordem INTO v_ordem
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = p_empresa_id
  LIMIT 1;
  RETURN v_ordem;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Helper: get user hierarchy role NAME
CREATE OR REPLACE FUNCTION get_user_role_name(p_auth_id uuid, p_empresa_id uuid)
RETURNS text AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT h.nome INTO v_nome
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = p_empresa_id
  LIMIT 1;
  RETURN v_nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- SIMPLIFIED RLS: any user in the company can see all empresa_usuarios and hierarquias
-- Frontend handles hierarchy filtering for actions
-- =============================================================================

-- hierarquias: anyone in the company can read/write
CREATE POLICY hierarquias_select ON hierarquias
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = hierarquias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY hierarquias_insert ON hierarquias
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = hierarquias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY hierarquias_update ON hierarquias
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = hierarquias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY hierarquias_delete ON hierarquias
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = hierarquias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

-- empresa_usuarios: anyone in the company can see all
CREATE POLICY empresa_usuarios_select ON empresa_usuarios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE meu.empresa_id = empresa_usuarios.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY empresa_usuarios_insert ON empresa_usuarios
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE meu.empresa_id = empresa_usuarios.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY empresa_usuarios_update ON empresa_usuarios
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE meu.empresa_id = empresa_usuarios.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

-- usuarios: anyone can read
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY usuarios_insert ON usuarios
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );
