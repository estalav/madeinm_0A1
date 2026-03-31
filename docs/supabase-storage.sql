-- Hecho Aqui
-- Supabase Storage buckets and policies
-- Date: 2026-03-30
--
-- Apply this after:
-- 1. docs/supabase-schema.sql
-- 2. docs/supabase-seed.sql
-- 3. docs/supabase-rls.sql
--
-- Buckets:
-- - product-images: curated product images managed by admins
-- - scan-uploads: user-submitted scan photos tied to uploader identity

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'scan-uploads',
    'scan-uploads',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

create or replace function public.is_owner_folder(object_name text)
returns boolean
language sql
stable
as $$
  select split_part(object_name, '/', 1) = auth.uid()::text;
$$;

grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;

-- Public curated product images

create policy "public can read curated product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "admins can upload curated product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
);

create policy "admins can update curated product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_admin()
);

create policy "admins can delete curated product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
);

-- Private user scan uploads

create policy "users can read their own scan uploads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scan-uploads'
  and public.is_owner_folder(name)
);

create policy "users can upload their own scan images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'scan-uploads'
  and public.is_owner_folder(name)
);

create policy "users can update their own scan images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'scan-uploads'
  and public.is_owner_folder(name)
)
with check (
  bucket_id = 'scan-uploads'
  and public.is_owner_folder(name)
);

create policy "users can delete their own scan images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'scan-uploads'
  and public.is_owner_folder(name)
);

create policy "admins can read all scan uploads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scan-uploads'
  and public.is_admin()
);

commit;
