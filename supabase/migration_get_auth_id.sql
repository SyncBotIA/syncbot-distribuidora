-- =============================================================================
-- RPC: get_or_create_auth_user_id
-- Retorna o auth_id de um usuario pelo email (sem precisar fazer login)
-- Usada para re-cadastrar usuarios que foram excluidos da empresa
-- =============================================================================
CREATE OR REPLACE FUNCTION get_or_create_auth_user_id(
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_id uuid;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE LOWER(email) = LOWER(p_email);

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuario com email "%" nao encontrado no auth.', p_email;
  END IF;

  RETURN v_auth_id;
END;
$$;
