-- Drop existing cron jobs
SELECT cron.unschedule('daily-stock-alerts');
SELECT cron.unschedule('daily-event-reminders');

-- Create new cron jobs for 5:30 AM
SELECT
cron.schedule(
  'daily-stock-alerts-530am',
  '30 5 * * *', -- 5:30 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-stock-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

SELECT
cron.schedule(
  'daily-event-reminders-530am',
  '30 5 * * *', -- 5:30 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-event-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);