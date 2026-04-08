begin;

create table if not exists public.recognition_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  session_type text not null default 'guest' check (session_type in ('guest', 'authenticated')),
  source_surface text not null default 'web_scan_guest',
  guessed_product_id uuid references public.products(id) on delete set null,
  guessed_product_name text,
  corrected_product_id uuid references public.products(id) on delete set null,
  corrected_product_name text,
  correction_mode text not null check (correction_mode in ('catalog', 'draft')),
  visual_guess text,
  barcode_value text,
  origin_assessment text,
  origin_explanation text,
  reasoning text,
  detected_text text,
  market_context text,
  vendor_origin_hint text,
  observed_text_hint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recognition_feedback_created_at
on public.recognition_feedback (created_at desc);

create index if not exists idx_recognition_feedback_corrected_product
on public.recognition_feedback (corrected_product_id);

create index if not exists idx_recognition_feedback_guessed_product
on public.recognition_feedback (guessed_product_id);

grant all on public.recognition_feedback to authenticated;

alter table public.recognition_feedback enable row level security;

drop policy if exists "recognition feedback is readable by admins" on public.recognition_feedback;
create policy "recognition feedback is readable by admins"
on public.recognition_feedback
for select
to authenticated
using (public.is_admin());

drop policy if exists "recognition feedback is writable by admins" on public.recognition_feedback;
create policy "recognition feedback is writable by admins"
on public.recognition_feedback
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "recognition feedback is updateable by admins" on public.recognition_feedback;
create policy "recognition feedback is updateable by admins"
on public.recognition_feedback
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "recognition feedback is deletable by admins" on public.recognition_feedback;
create policy "recognition feedback is deletable by admins"
on public.recognition_feedback
for delete
to authenticated
using (public.is_admin());

commit;
