-- Create stock records for existing items that don't have them
INSERT INTO public.stock (item_id, current_quantity, last_updated_by)
SELECT i.id, 0, i.created_by
FROM public.items i
LEFT JOIN public.stock s ON i.id = s.item_id
WHERE s.item_id IS NULL;