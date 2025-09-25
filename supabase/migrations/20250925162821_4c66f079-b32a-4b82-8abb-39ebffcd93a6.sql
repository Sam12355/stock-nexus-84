-- Admins can view and update all stock
CREATE POLICY "Admins can view all stock"
ON public.stock
FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all stock"
ON public.stock
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Allow inserting stock rows for branch items and admins
CREATE POLICY "Users can insert stock for branch items"
ON public.stock
FOR INSERT
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin'
  OR item_id IN (
    SELECT i.id FROM public.items i
    WHERE i.branch_id = public.get_user_branch(auth.uid())
  )
);

-- Admin policies for stock_movements
CREATE POLICY "Admins can view all stock movements"
ON public.stock_movements
FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');