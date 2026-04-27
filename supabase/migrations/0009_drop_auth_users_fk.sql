-- Drop the foreign key from profiles.id → auth.users(id)
-- Required after removing Supabase Auth: profiles are now standalone rows
-- inserted directly by the custom JWT auth registration endpoint.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
