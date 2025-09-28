-- Create the new cron job for regular alerts every 5 minutes
//SELECT cron.schedule(
//  'send-regular-alerts-every-5-min',
//  '*/5 * * * *',
//  $$
//  SELECT
//    net.http_post(
//        url:='https://cttkveosybpyqlezenfc.supabase.co/functions/v1/send-regular-alerts',
//        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGt2ZW9zeWJweXFsZXplbmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA2NDksImV4cCI6MjA3NDM4NjY0OX0.pvBJjseO50vYwil6y38SABHy9YheqkEYyxcaJ_bdJ-w"}'::jsonb,
 //       body:=concat('{"time": "', now(), '"}')::jsonb
//   ) as request_id;
 // $$
//);