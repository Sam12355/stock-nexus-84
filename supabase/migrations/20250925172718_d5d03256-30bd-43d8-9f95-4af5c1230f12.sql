-- Update the user_role enum to include new role names
ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM ('regional_manager', 'district_manager', 'manager', 'assistant_manager', 'staff');

-- Update the profiles table to use the new enum
ALTER TABLE profiles 
ALTER COLUMN role DROP DEFAULT,
ALTER COLUMN role TYPE user_role USING 
  CASE 
    WHEN role::text = 'admin' THEN 'regional_manager'::user_role
    ELSE role::text::user_role
  END,
ALTER COLUMN role SET DEFAULT 'staff'::user_role;

-- Update any existing admin users to regional_manager
UPDATE profiles SET role = 'regional_manager' WHERE role::text = 'admin';

-- Drop the old enum type
DROP TYPE user_role_old;

-- Update all database functions that reference the old role names
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role::TEXT FROM public.profiles WHERE user_id = user_uuid;
$function$;