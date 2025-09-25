-- Fix the stock function to use profile.id instead of auth.uid() for last_updated_by
CREATE OR REPLACE FUNCTION public.update_stock_quantity(p_item_id uuid, p_movement_type text, p_quantity integer, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_stock INTEGER;
  new_stock INTEGER;
  item_threshold INTEGER;
  stock_status TEXT;
  user_profile_id UUID;
BEGIN
  -- Get the user's profile ID
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  -- Get current stock
  SELECT current_quantity INTO current_stock
  FROM public.stock
  WHERE item_id = p_item_id;
  
  -- Calculate new stock
  IF p_movement_type = 'in' THEN
    new_stock := current_stock + p_quantity;
  ELSE
    new_stock := current_stock - p_quantity;
  END IF;
  
  -- Ensure stock doesn't go negative
  IF new_stock < 0 THEN
    new_stock := 0;
  END IF;
  
  -- Update stock table
  UPDATE public.stock 
  SET 
    current_quantity = new_stock,
    last_updated_by = user_profile_id,
    last_updated = now()
  WHERE item_id = p_item_id;
  
  -- Insert movement record
  INSERT INTO public.stock_movements (
    item_id, movement_type, quantity, previous_quantity, new_quantity, reason, updated_by
  ) VALUES (
    p_item_id, p_movement_type, p_quantity, current_stock, new_stock, p_reason, user_profile_id
  );
  
  -- Get item threshold for status calculation
  SELECT threshold_level INTO item_threshold
  FROM public.items
  WHERE id = p_item_id;
  
  -- Determine stock status
  IF new_stock <= (item_threshold * 0.5) THEN
    stock_status := 'critical';
  ELSIF new_stock <= item_threshold THEN
    stock_status := 'low';
  ELSE
    stock_status := 'adequate';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'previous_quantity', current_stock,
    'new_quantity', new_stock,
    'status', stock_status
  );
END;
$function$;