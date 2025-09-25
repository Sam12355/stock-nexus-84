-- Create admin profile manually (will create auth user via signup)
-- We'll update an existing user to admin role temporarily
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'slaksh7@gmail.com';