-- Fix RLS policies for calendar_events to allow proper access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view branch calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Admins and managers can manage calendar events" ON calendar_events;

-- Create new policies using security definer functions to avoid recursion
CREATE POLICY "Users can view their branch calendar events"
ON calendar_events FOR SELECT
TO authenticated
USING (
  branch_id = get_user_branch(auth.uid()) OR
  get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])
);

CREATE POLICY "Managers can insert calendar events"
ON calendar_events FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text])
);

CREATE POLICY "Managers can update their branch calendar events"
ON calendar_events FOR UPDATE
TO authenticated
USING (
  (branch_id = get_user_branch(auth.uid()) AND get_user_role(auth.uid()) = ANY(ARRAY['manager'::text, 'assistant_manager'::text])) OR
  get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])
);

CREATE POLICY "Managers can delete their branch calendar events"
ON calendar_events FOR DELETE
TO authenticated
USING (
  (branch_id = get_user_branch(auth.uid()) AND get_user_role(auth.uid()) = ANY(ARRAY['manager'::text, 'assistant_manager'::text])) OR
  get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])
);