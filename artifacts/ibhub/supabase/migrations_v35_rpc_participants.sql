-- Migration v35: RPCs to bypass cp_select RLS for cross-participant lookups
-- cp_select only shows the authenticated user's own row (user_id = auth.uid()).
-- These SECURITY DEFINER functions run as the table owner and bypass RLS,
-- allowing safe, controlled cross-participant lookups.

-- 1. Get the other participant's user_id in a direct conversation
CREATE OR REPLACE FUNCTION get_conversation_other_participant(
  p_conversation_id uuid,
  p_current_user_id uuid
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.user_id
  FROM conversation_participants cp
  WHERE cp.conversation_id = p_conversation_id
    AND cp.user_id != p_current_user_id
  LIMIT 1;
$$;

-- 2. Get all conversations for a user together with the other participant's user_id
--    Returns: conversation_id, other_user_id (null for group convos), my_accepted
CREATE OR REPLACE FUNCTION get_my_conversations_participants(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, other_user_id uuid, my_accepted boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    my_cp.conversation_id,
    other_cp.user_id  AS other_user_id,
    my_cp.accepted    AS my_accepted
  FROM conversation_participants my_cp
  LEFT JOIN conversation_participants other_cp
    ON other_cp.conversation_id = my_cp.conversation_id
   AND other_cp.user_id != p_user_id
  WHERE my_cp.user_id = p_user_id;
$$;

-- 3. Check for an existing direct conversation between two users
--    Returns the conversation_id if one exists, otherwise returns nothing
CREATE OR REPLACE FUNCTION get_direct_conversation(p_user1 uuid, p_user2 uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT my_cp.conversation_id
  FROM conversation_participants my_cp
  JOIN conversation_participants other_cp
    ON other_cp.conversation_id = my_cp.conversation_id
   AND other_cp.user_id = p_user2
  WHERE my_cp.user_id = p_user1
  LIMIT 1;
$$;
