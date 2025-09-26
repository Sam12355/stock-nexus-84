-- Fix RLS policies on branches to allow admins to insert/update without being restricted by other roles

-- Drop existing restrictive policies to avoid AND-combining that blocks access
DROP POLICY IF EXISTS "Admins can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "District managers can manage branches in their district" ON public.branches;
DROP POLICY IF EXISTS "Regional managers can manage branches in their region" ON public.branches;
DROP POLICY IF EXISTS "Users can view their assigned branch" ON public.branches;

-- Recreate PERMISSIVE policies
-- Admins: full access to all operations
CREATE POLICY "Admins can manage all branches"
ON public.branches
AS PERMISSIVE
FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- District managers: manage branches in their district
CREATE POLICY "District managers can manage branches in their district"
ON public.branches
AS PERMISSIVE
FOR ALL
USING (
  district_id = (
    SELECT profiles.district_id FROM profiles WHERE profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  district_id = (
    SELECT profiles.district_id FROM profiles WHERE profiles.user_id = auth.uid()
  )
);

-- Regional managers: manage branches in their region
CREATE POLICY "Regional managers can manage branches in their region"
ON public.branches
AS PERMISSIVE
FOR ALL
USING (
  region_id IN (
    SELECT regions.id
    FROM regions
    WHERE regions.regional_manager_id = (
      SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  region_id IN (
    SELECT regions.id
    FROM regions
    WHERE regions.regional_manager_id = (
      SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
    )
  )
);

-- Staff and others: can view their assigned branch only
CREATE POLICY "Users can view their assigned branch"
ON public.branches
AS PERMISSIVE
FOR SELECT
USING (id = get_user_branch(auth.uid()));