-- Update event_alerts alert_time default to 19:10 and migrate existing rows
ALTER TABLE public.event_alerts
  ALTER COLUMN alert_time SET DEFAULT '19:10:00';

UPDATE public.event_alerts
  SET alert_time = '19:10:00'
  WHERE alert_time IN ('08:00:00', '19:05:00');
