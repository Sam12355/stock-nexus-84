-- Update RLS policies for items table to use new role names
DROP POLICY IF EXISTS "Admins can manage all items" ON items;
DROP POLICY IF EXISTS "Admins can view all items" ON items;
DROP POLICY IF EXISTS "Managers can manage branch items" ON items;

-- Regional and District managers can manage all items
CREATE POLICY "Regional and District managers can manage all items"
ON items FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]))
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]));

-- Managers can manage branch items
CREATE POLICY "Managers can manage branch items"
ON items FOR ALL
TO authenticated
USING ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text])) AND (branch_id = get_user_branch(auth.uid())))
WITH CHECK ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text])) AND (branch_id = get_user_branch(auth.uid())));