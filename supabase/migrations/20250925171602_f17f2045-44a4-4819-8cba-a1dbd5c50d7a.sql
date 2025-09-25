-- Update calendar_events RLS policy to allow admins to create events for any branch
DROP POLICY IF EXISTS "Managers can manage calendar events" ON public.calendar_events;

-- Allow admins to manage events for any branch, managers only for their branch
CREATE POLICY "Admins and managers can manage calendar events" 
ON public.calendar_events 
FOR ALL
TO authenticated
USING (
  (get_user_role(auth.uid()) = 'admin'::text) OR 
  ((get_user_role(auth.uid()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text])) AND (branch_id = get_user_branch(auth.uid())))
)
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin'::text) OR 
  ((get_user_role(auth.uid()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text])) AND (branch_id = get_user_branch(auth.uid())))
);