begin;

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai usage logs are readable by admins" on public.ai_usage_logs;
create policy "ai usage logs are readable by admins"
on public.ai_usage_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "ai usage logs are writable by admins" on public.ai_usage_logs;
create policy "ai usage logs are writable by admins"
on public.ai_usage_logs
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "ai usage logs are updateable by admins" on public.ai_usage_logs;
create policy "ai usage logs are updateable by admins"
on public.ai_usage_logs
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ai usage logs are deletable by admins" on public.ai_usage_logs;
create policy "ai usage logs are deletable by admins"
on public.ai_usage_logs
for delete
to authenticated
using (public.is_admin());

commit;
