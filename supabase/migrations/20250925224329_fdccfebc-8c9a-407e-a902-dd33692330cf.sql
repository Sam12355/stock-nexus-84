-- Update log_user_activity to use branch_context fallback when branch_id is null
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action text,
  p_details text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_branch_id uuid;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Use provided branch_id or get from user; if null, fallback to branch_context
  v_branch_id := COALESCE(p_branch_id, get_user_branch(v_user_id));
  IF v_branch_id IS NULL THEN
    SELECT branch_context INTO v_branch_id FROM public.profiles WHERE user_id = v_user_id;
  END IF;
  
  -- Insert activity log
  INSERT INTO activity_logs (action, details, user_id, branch_id)
  VALUES (
    p_action,
    COALESCE(p_details, '{}')::jsonb,
    v_user_id,
    v_branch_id
  );
END;
$$;