-- Grant execute permission on the stock update function to authenticated users
GRANT EXECUTE ON FUNCTION public.update_stock_quantity(uuid, text, integer, text) TO authenticated;

-- Ensure the function can bypass RLS for its internal operations
ALTER FUNCTION public.update_stock_quantity(uuid, text, integer, text) SECURITY DEFINER;