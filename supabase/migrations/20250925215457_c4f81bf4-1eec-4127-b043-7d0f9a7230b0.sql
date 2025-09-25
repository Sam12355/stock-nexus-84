-- Add policies to allow regional and district managers to view activity logs and stock movements

-- Activity logs: allow regional and district managers to view
CREATE POLICY "Regional and District managers can view activity logs"
ON public.activity_logs
FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('regional_manager', 'district_manager'));

-- Stock movements: allow regional and district managers to view all
CREATE POLICY "Regional and District managers can view all stock movements"
ON public.stock_movements
FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('regional_manager', 'district_manager'));
