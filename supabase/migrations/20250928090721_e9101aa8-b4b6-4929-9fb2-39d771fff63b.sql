-- Set up cron jobs for daily stock alerts and event reminders

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily stock alerts at 2:00 PM
SELECT cron.schedule(
  'daily-stock-alerts-2pm',
  '0 14 * * *', -- 2:00 PM every day
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-stock-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:=concat('{"time": "', now(), '", "type": "daily_stock_alerts"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule daily event reminders at 2:05 PM
SELECT cron.schedule(
  'daily-event-reminders-205pm',
  '5 14 * * *', -- 2:05 PM every day
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-event-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:=concat('{"time": "', now(), '", "type": "daily_event_reminders"}')::jsonb
    ) as request_id;
  $$
);