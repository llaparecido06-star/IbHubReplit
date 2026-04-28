-- v64: Add SECURITY DEFINER function for safe ownership transfer
-- This bypasses RLS so we can atomically:
--  1. Update owner_id on company_pages
--  2. Remove new owner from company_page_admins
--  3. Add old owner as editor in company_page_admins

CREATE OR REPLACE FUNCTION transfer_company_ownership(
  p_page_id     uuid,
  p_new_owner   uuid,
  p_old_owner   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner uuid;
BEGIN
  -- Verify the caller is the current owner
  SELECT owner_id INTO v_current_owner
  FROM company_pages
  WHERE id = p_page_id;

  IF v_current_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Página não encontrada');
  END IF;

  IF v_current_owner <> p_old_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas o proprietário pode transferir a propriedade');
  END IF;

  IF v_current_owner = p_new_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Novo proprietário não pode ser o mesmo');
  END IF;

  -- 1. Transfer ownership
  UPDATE company_pages
  SET owner_id = p_new_owner
  WHERE id = p_page_id;

  -- 2. Remove new owner from admins table (they are now the owner)
  DELETE FROM company_page_admins
  WHERE company_page_id = p_page_id AND user_id = p_new_owner;

  -- 3. Demote old owner to editor (upsert)
  INSERT INTO company_page_admins (company_page_id, user_id, role)
  VALUES (p_page_id, p_old_owner, 'editor')
  ON CONFLICT (company_page_id, user_id) DO UPDATE SET role = 'editor';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION transfer_company_ownership(uuid, uuid, uuid) TO authenticated;
