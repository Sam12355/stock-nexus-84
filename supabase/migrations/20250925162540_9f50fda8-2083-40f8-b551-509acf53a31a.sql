-- Create a trigger to automatically create stock records when items are added
CREATE OR REPLACE FUNCTION public.create_stock_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.stock (item_id, current_quantity, last_updated_by)
  VALUES (NEW.id, 0, NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic stock record creation
CREATE TRIGGER create_stock_on_item_insert
  AFTER INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_stock_record();