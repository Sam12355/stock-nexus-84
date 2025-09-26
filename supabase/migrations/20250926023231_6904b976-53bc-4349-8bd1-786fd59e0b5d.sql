-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job to run daily stock alerts at 6 PM
SELECT cron.schedule(
  'daily-stock-alerts-6pm',
  '0 18 * * *', -- Run at 6:00 PM every day (18:00 in 24-hour format)
  $$
  SELECT
    net.http_post(
        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/daily-stock-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
        body:='{"scheduled": true, "time": "daily-6pm"}'::jsonb
    ) AS request_id;
  $$
);