-- Add notification_settings column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN notification_settings jsonb DEFAULT '{"whatsapp": false, "stockLevelAlerts": false, "eventReminders": false}'::jsonb;