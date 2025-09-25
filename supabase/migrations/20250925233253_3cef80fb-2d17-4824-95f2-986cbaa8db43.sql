-- Update RLS policies to allow admin to see all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles 
FOR SELECT 
TO authenticated
USING (get_user_role(auth.uid()) = 'admin');

-- Update RLS policies to allow admin to manage all profiles
DROP POLICY IF EXISTS "Admins can insert all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;

CREATE POLICY "Admins can insert all profiles"
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all profiles"
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete all profiles"
ON public.profiles 
FOR DELETE 
TO authenticated
USING (get_user_role(auth.uid()) = 'admin');