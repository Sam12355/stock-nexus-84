-- Ensure activity logs record the correct profile id and branch
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
  v_auth_user uuid;
  v_profile_id uuid;
  v_branch_id uuid;
BEGIN
  -- Prefer explicit param, else authenticated user
  v_auth_user := COALESCE(p_user_id, auth.uid());

  -- Resolve profile id from auth user id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_auth_user;

  -- Resolve branch: explicit param, else user's branch, else branch_context
  v_branch_id := p_branch_id;
  IF v_branch_id IS NULL THEN
    SELECT COALESCE(branch_id, branch_context) INTO v_branch_id FROM public.profiles WHERE user_id = v_auth_user;
  END IF;

  -- Insert log (allow nulls if profile/branch missing to avoid FK/UUID errors)
  INSERT INTO activity_logs (action, details, user_id, branch_id)
  VALUES (
    p_action,
    COALESCE(p_details, '{}')::jsonb,
    v_profile_id,
    v_branch_id
  );
END;
$$;