-- Orange Salon — media storage.
--
-- One public bucket for catalogue and portfolio media (service images, stylist
-- portraits, gallery photos and reels). Files are served by public URL, so no
-- public SELECT policy is needed (and listing the bucket stays closed).
-- No customer files are stored anywhere, so no private bucket is required.
-- Size and type limits are enforced here by Storage and again by the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "media readable by admins" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select private.is_admin()));

create policy "media uploaded by admins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_admin()));

create policy "media replaced by admins" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select private.is_admin()))
  with check (bucket_id = 'media' and (select private.is_admin()));

create policy "media deleted by admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select private.is_admin()));
