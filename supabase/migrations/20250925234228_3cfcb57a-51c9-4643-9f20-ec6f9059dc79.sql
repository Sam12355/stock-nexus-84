-- Add RLS policy to allow admin to view all branches
DROP POLICY IF EXISTS "Admins can view all branches" ON public.branches;

CREATE POLICY "Admins can view all branches"
ON public.branches 
FOR SELECT 
TO authenticated
USING (get_user_role(auth.uid()) = 'admin');

-- Add RLS policy to allow admin to manage all branches
DROP POLICY IF EXISTS "Admins can manage all branches" ON public.branches;

CREATE POLICY "Admins can manage all branches"
ON public.branches 
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');