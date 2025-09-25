-- Create public bucket for user uploads (images)
insert into storage.buckets (id, name, public)
values ('user-uploads', 'user-uploads', true)
on conflict (id) do nothing;

-- Reset and create policies for user-uploads bucket
drop policy if exists "Public read user-uploads" on storage.objects;
create policy "Public read user-uploads"
on storage.objects
for select
using (bucket_id = 'user-uploads');

drop policy if exists "Authenticated upload user-uploads" on storage.objects;
create policy "Authenticated upload user-uploads"
on storage.objects
for insert to authenticated
with check (bucket_id = 'user-uploads');

drop policy if exists "Authenticated update user-uploads" on storage.objects;
create policy "Authenticated update user-uploads"
on storage.objects
for update to authenticated
using (bucket_id = 'user-uploads');

drop policy if exists "Authenticated delete user-uploads" on storage.objects;
create policy "Authenticated delete user-uploads"
on storage.objects
for delete to authenticated
using (bucket_id = 'user-uploads');