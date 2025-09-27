-- Allow regional managers to view all branches in their assigned region via their profile
-- This complements existing policies that depend on regions.regional_manager_id
CREATE POLICY "Regional managers can view branches via profile region"
ON public.branches
FOR SELECT
USING (
  get_user_role(auth.uid()) = 'regional_manager'
  AND region_id = (
    SELECT profiles.region_id FROM public.profiles WHERE profiles.user_id = auth.uid()
  )
);