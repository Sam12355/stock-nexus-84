-- Drop the previous implementation
DROP TRIGGER IF EXISTS schedule_event_alert_trigger ON public.calendar_events;
DROP TRIGGER IF EXISTS unschedule_event_alert_trigger ON public.calendar_events;
DROP FUNCTION IF EXISTS public.schedule_event_alert();
DROP FUNCTION IF EXISTS public.unschedule_event_alert();

-- Create a simpler scheduled event alerts table
CREATE TABLE IF NOT EXISTS public.event_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  alert_date DATE NOT NULL,
  alert_time TIME NOT NULL DEFAULT '08:00:00',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on the event alerts table
ALTER TABLE public.event_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for event alerts
CREATE POLICY "Users can view their branch event alerts"
ON public.event_alerts
FOR SELECT
USING (
  branch_id = get_user_branch(auth.uid())
  OR get_user_role(auth.uid()) = ANY (ARRAY['regional_manager'::text, 'district_manager'::text, 'admin'::text])
);

CREATE POLICY "Managers can manage event alerts"
ON public.event_alerts
FOR ALL
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text, 'admin'::text])
)
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['regional_manager'::text, 'district_manager'::text, 'manager'::text, 'assistant_manager'::text, 'admin'::text])
);

-- Create function to automatically create event alerts for 'alert' type events
CREATE OR REPLACE FUNCTION public.create_event_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only create alerts for events with type 'alert'
  IF NEW.event_type = 'alert' THEN
    INSERT INTO public.event_alerts (event_id, branch_id, alert_date)
    VALUES (NEW.id, NEW.branch_id, NEW.event_date);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically create alerts when events are created
CREATE TRIGGER create_event_alert_trigger
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.create_event_alert();