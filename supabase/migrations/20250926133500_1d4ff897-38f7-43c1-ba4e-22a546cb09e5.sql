-- Add missing description column to branches to match frontend usage
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS description text;