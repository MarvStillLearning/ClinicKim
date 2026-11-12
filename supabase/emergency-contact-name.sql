-- Run in Supabase > SQL Editor for databases created before emergency contact names were added.
alter table public.patients
  add column if not exists emergency_contact_name text;

notify pgrst, 'reload schema';
