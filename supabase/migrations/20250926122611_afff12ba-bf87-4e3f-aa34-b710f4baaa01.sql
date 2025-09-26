-- Create regions table
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  regional_manager_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create districts table
CREATE TABLE public.districts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add region_id and district_id to branches table
ALTER TABLE public.branches 
ADD COLUMN region_id UUID REFERENCES public.regions(id),
ADD COLUMN district_id UUID REFERENCES public.districts(id);

-- Add region_id and district_id to profiles table for managers
ALTER TABLE public.profiles
ADD COLUMN region_id UUID REFERENCES public.regions(id),
ADD COLUMN district_id UUID REFERENCES public.districts(id);

-- Enable Row Level Security
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for regions
CREATE POLICY "Admins can manage all regions" 
ON public.regions 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::text);

CREATE POLICY "Regional managers can view their region" 
ON public.regions 
FOR SELECT 
USING (regional_manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view regions for selection" 
ON public.regions 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text]));

-- Create RLS policies for districts
CREATE POLICY "Admins can manage all districts" 
ON public.districts 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::text);

CREATE POLICY "Regional managers can manage districts in their region" 
ON public.districts 
FOR ALL 
USING (region_id IN (SELECT id FROM public.regions WHERE regional_manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
WITH CHECK (region_id IN (SELECT id FROM public.regions WHERE regional_manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "District managers can view their district" 
ON public.districts 
FOR SELECT 
USING (id = (SELECT district_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view districts for selection" 
ON public.districts 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text]));

-- Update branches RLS policies to include region/district access
DROP POLICY IF EXISTS "Regional and District managers can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "Users can view their assigned branch" ON public.branches;
DROP POLICY IF EXISTS "Admins can view all branches" ON public.branches;

CREATE POLICY "Admins can manage all branches" 
ON public.branches 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::text);

CREATE POLICY "Regional managers can manage branches in their region" 
ON public.branches 
FOR ALL 
USING (region_id IN (SELECT id FROM public.regions WHERE regional_manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
WITH CHECK (region_id IN (SELECT id FROM public.regions WHERE regional_manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "District managers can manage branches in their district" 
ON public.branches 
FOR ALL 
USING (district_id = (SELECT district_id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (district_id = (SELECT district_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their assigned branch" 
ON public.branches 
FOR SELECT 
USING (id = get_user_branch(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_regions_updated_at
BEFORE UPDATE ON public.regions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_districts_updated_at
BEFORE UPDATE ON public.districts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();