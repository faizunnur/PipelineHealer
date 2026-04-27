-- Add password_hash column to profiles for custom auth (replaces Supabase Auth)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
