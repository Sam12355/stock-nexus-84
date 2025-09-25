-- Update RLS policies for branches to allow regional_manager and district_manager to view all branches
DROP POLICY IF EXISTS "Admins can manage all branches" ON branches;
DROP POLICY IF EXISTS "Users can view their branch" ON branches;

-- Regional and District managers can manage all branches  
CREATE POLICY "Regional and District managers can manage all branches"
ON branches FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]))
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['regional_manager'::text, 'district_manager'::text]));

-- Users can view their assigned branch
CREATE POLICY "Users can view their assigned branch"
ON branches FOR SELECT  
TO authenticated
USING (id = get_user_branch(auth.uid()));

-- Add branch_context column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_context uuid;