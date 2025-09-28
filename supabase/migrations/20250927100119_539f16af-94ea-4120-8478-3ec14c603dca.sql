//-- Drop the existing cron job
//SELECT cron.unschedule('daily-event-alerts');

//-- Create a new cron job to test event alerts every 5 minutes
//SELECT cron.schedule(
//  'test-event-alerts-5min',
//  '*/5 * * * *', -- Every 5 minutes
//  $$
//  SELECT net.http_post(
//    url := 'https://cttkveosybpyqlezenfc.supabase.co/functions/v1/send-event-alerts',
//    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
//    body := '{"trigger": "test_check"}'::jsonb
//  ) as request_id;
//  $$
//);