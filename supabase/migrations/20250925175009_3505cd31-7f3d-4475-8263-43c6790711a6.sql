-- Update RLS policies for profiles table to use new role names
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can insert staff profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can update branch profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can delete branch profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view branch profiles" ON profiles;

-- Regional and District managers can view all profiles
CREATE POLICY "Regional and District managers can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]));

-- Managers can insert staff profiles
CREATE POLICY "Managers can insert staff profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text]));

-- Managers can update branch profiles
CREATE POLICY "Managers can update branch profiles"
ON profiles FOR UPDATE
TO authenticated
USING ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text])) AND ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])) OR (branch_id = get_user_branch(auth.uid()))));

-- Managers can delete branch profiles  
CREATE POLICY "Managers can delete branch profiles"
ON profiles FOR DELETE
TO authenticated
USING ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text])) AND ((get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text])) OR (branch_id = get_user_branch(auth.uid()))));

-- Managers can view branch profiles
CREATE POLICY "Managers can view branch profiles"
ON profiles FOR SELECT
TO authenticated
USING ((get_user_role(auth.uid()) = ANY(ARRAY['manager'::text, 'assistant_manager'::text])) AND (branch_id = get_user_branch(auth.uid())));