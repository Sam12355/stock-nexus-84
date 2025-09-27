-- Create function to schedule event alerts
CREATE OR REPLACE FUNCTION public.schedule_event_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only schedule alerts for events with type 'alert'
  IF NEW.event_type = 'alert' THEN
    -- Schedule cron job for the event date at 8:00 AM
    -- Using pg_cron to schedule the notification
    PERFORM cron.schedule(
      'event_alert_' || NEW.id::text,
      '0 8 ' || EXTRACT(DAY FROM NEW.event_date)::text || ' ' || 
      EXTRACT(MONTH FROM NEW.event_date)::text || ' *',
      $$
      SELECT net.http_post(
        url := 'https://cttkveosybpyqlezenfc.supabase.co/functions/v1/send-event-reminder',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body := json_build_object(
          'eventTitle', $$ || quote_literal(NEW.title) || $$,
          'eventDescription', $$ || quote_literal(COALESCE(NEW.description, '')) || $$,
          'eventDate', $$ || quote_literal(NEW.event_date::text) || $$,
          'eventType', $$ || quote_literal(NEW.event_type) || $$,
          'branchId', $$ || quote_literal(NEW.branch_id::text) || $$,
          'reminderType', 'immediate'
        )::jsonb
      );
      $$
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically schedule alerts when events are created
CREATE TRIGGER schedule_event_alert_trigger
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_event_alert();

-- Also create function to unschedule when events are deleted
CREATE OR REPLACE FUNCTION public.unschedule_event_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Unschedule the cron job
  IF OLD.event_type = 'alert' THEN
    PERFORM cron.unschedule('event_alert_' || OLD.id::text);
  END IF;
  
  RETURN OLD;
END;
$function$;

-- Create trigger to unschedule alerts when events are deleted
CREATE TRIGGER unschedule_event_alert_trigger
  BEFORE DELETE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.unschedule_event_alert();

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create table to track scheduled event notifications
CREATE TABLE IF NOT EXISTS public.scheduled_event_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on the new table
ALTER TABLE public.scheduled_event_notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for the scheduled notifications table
CREATE POLICY "Users can view scheduled notifications for their branch events"
ON public.scheduled_event_notifications
FOR SELECT
USING (
  event_id IN (
    SELECT id FROM public.calendar_events 
    WHERE branch_id = get_user_branch(auth.uid())
  )
);