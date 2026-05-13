-- Ensure public item-images bucket and RLS policies exist (Dashboard bucket alone
-- does not create storage.objects policies; uploads fail with RLS / permission errors).

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "item_images_public_read" on storage.objects;
drop policy if exists "item_images_auth_insert" on storage.objects;

create policy "item_images_public_read" on storage.objects
for select using (bucket_id = 'item-images');

create policy "item_images_auth_insert" on storage.objects
for insert with check (bucket_id = 'item-images' and auth.uid() is not null);
