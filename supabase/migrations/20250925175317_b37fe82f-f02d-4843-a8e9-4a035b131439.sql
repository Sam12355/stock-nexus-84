-- Update RLS policies for stock table to use new role names
DROP POLICY IF EXISTS "Admins can update all stock" ON stock;
DROP POLICY IF EXISTS "Admins can view all stock" ON stock;
DROP POLICY IF EXISTS "Users can insert stock for branch items" ON stock;

-- Regional and District managers can update all stock
CREATE POLICY "Regional and District managers can update all stock"
ON stock FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]));

-- Regional and District managers can view all stock
CREATE POLICY "Regional and District managers can view all stock"
ON stock FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]));

-- Users can insert stock for branch items (updated)
CREATE POLICY "Users can insert stock for branch items"
ON stock FOR INSERT
TO authenticated
WITH CHECK ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])) OR (item_id IN ( SELECT i.id FROM items i WHERE (i.branch_id = get_user_branch(auth.uid())))));