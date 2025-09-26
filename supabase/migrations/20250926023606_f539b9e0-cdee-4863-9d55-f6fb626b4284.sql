-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create daily stock alerts cron job at 5am
SELECT cron.schedule(
  'daily-stock-alerts',
  '0 5 * * *', -- 5:00 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-stock-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create daily event reminders cron job at 5am
SELECT cron.schedule(
  'daily-event-reminders',
  '0 5 * * *', -- 5:00 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-event-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);