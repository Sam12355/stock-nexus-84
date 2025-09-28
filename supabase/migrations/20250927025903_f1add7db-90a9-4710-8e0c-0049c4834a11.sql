-- Create a cron job to check for event alerts every morning at 8:00 AM
SELECT cron.schedule(
  'daily-event-alerts',
  '0 19 * * *', -- Daily at 8:00 AM
  $$
  SELECT net.http_post(
    url := 'https://cttkveosybpyqlezenfc.supabase.co/functions/v1/send-event-alerts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
    body := '{"trigger": "daily_check"}'::jsonb
  ) as request_id;
  $$
);