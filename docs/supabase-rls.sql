-- Hecho Aqui
-- Supabase Row Level Security policies
-- Date: 2026-03-30
--
-- Apply this after:
-- 1. docs/supabase-schema.sql
-- 2. docs/supabase-seed.sql
--
-- Security model:
-- - Public users can read active catalog data.
-- - Authenticated users can manage only their own profile/activity data.
-- - Admins can manage curated data and review workflows.
--
-- Admin detection:
-- Set a user claim such as:
--   app_metadata = { "role": "admin" }
-- and the policies below will treat that user as an admin.

begin;

-- Make views respect the querying user's permissions instead of the view owner.

create or replace view public.product_summary
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.category,
  p.subcategory,
  p.brand_name,
  p.is_packaged,
  p.default_image_url,
  p.status,
  o.origin_status,
  o.confidence_level,
  o.summary_reason,
  np.calories
from public.products p
left join public.origins o on o.product_id = p.id
left join public.nutrition_profiles np on np.product_id = p.id;

create or replace view public.user_reward_totals
with (security_invoker = true) as
select
  re.user_id,
  coalesce(sum(re.points), 0) as total_points
from public.reward_events re
group by re.user_id;

-- Helper functions

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.is_active_product(target_product_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and p.status = 'active'
  );
$$;

grant usage on schema public to anon, authenticated;

grant select on public.product_summary to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_aliases to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.barcodes to anon, authenticated;
grant select on public.origins to anon, authenticated;
grant select on public.origin_evidence to anon, authenticated;
grant select on public.nutrition_profiles to anon, authenticated;
grant select on public.recipes to anon, authenticated;
grant select on public.recipe_products to anon, authenticated;
grant select on public.markets to anon, authenticated;
grant select on public.market_prices to anon, authenticated;
grant select on public.retailer_prices to anon, authenticated;
grant select on public.badges to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert on public.user_scans to authenticated;
grant select, insert on public.classification_runs to authenticated;
grant select on public.user_reward_totals to authenticated;
grant select on public.reward_events to authenticated;
grant select on public.user_badges to authenticated;

grant all on public.products to authenticated;
grant all on public.product_aliases to authenticated;
grant all on public.product_images to authenticated;
grant all on public.barcodes to authenticated;
grant all on public.origins to authenticated;
grant all on public.origin_evidence to authenticated;
grant all on public.nutrition_profiles to authenticated;
grant all on public.recipes to authenticated;
grant all on public.recipe_products to authenticated;
grant all on public.markets to authenticated;
grant all on public.market_prices to authenticated;
grant all on public.retailer_prices to authenticated;
grant all on public.badges to authenticated;
grant all on public.reward_events to authenticated;
grant all on public.user_badges to authenticated;
grant all on public.admin_reviews to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.product_images enable row level security;
alter table public.barcodes enable row level security;
alter table public.origins enable row level security;
alter table public.origin_evidence enable row level security;
alter table public.nutrition_profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_products enable row level security;
alter table public.markets enable row level security;
alter table public.market_prices enable row level security;
alter table public.retailer_prices enable row level security;
alter table public.classification_runs enable row level security;
alter table public.user_scans enable row level security;
alter table public.admin_reviews enable row level security;
alter table public.user_favorites enable row level security;
alter table public.reward_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Profiles

create policy "profiles are readable by owner"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles can be inserted by owner"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles can be updated by owner"
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- Public catalog reads

create policy "active products are publicly readable"
on public.products
for select
to anon, authenticated
using (status = 'active' or public.is_admin());

create policy "product aliases for active products are publicly readable"
on public.product_aliases
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "product images for active products are publicly readable"
on public.product_images
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "barcodes for active products are publicly readable"
on public.barcodes
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "origins for active products are publicly readable"
on public.origins
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "origin evidence for active products is publicly readable"
on public.origin_evidence
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "nutrition for active products is publicly readable"
on public.nutrition_profiles
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "recipes are publicly readable"
on public.recipes
for select
to anon, authenticated
using (true);

create policy "recipe products for active products are publicly readable"
on public.recipe_products
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "markets are publicly readable"
on public.markets
for select
to anon, authenticated
using (true);

create policy "market prices for active products are publicly readable"
on public.market_prices
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "retailer prices for active products are publicly readable"
on public.retailer_prices
for select
to anon, authenticated
using (public.is_active_product(product_id) or public.is_admin());

create policy "badges are publicly readable"
on public.badges
for select
to anon, authenticated
using (true);

-- User-owned data

create policy "favorites are readable by owner"
on public.user_favorites
for select
to authenticated
using (auth.uid() = user_id);

create policy "favorites can be inserted by owner"
on public.user_favorites
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "favorites can be deleted by owner"
on public.user_favorites
for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "classification runs are readable by owner"
on public.classification_runs
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "classification runs can be inserted by owner"
on public.classification_runs
for insert
to authenticated
with check (
  (user_id is null and public.is_admin())
  or auth.uid() = user_id
);

create policy "classification runs can be updated by admin"
on public.classification_runs
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "user scans are readable by owner"
on public.user_scans
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "user scans can be inserted by owner"
on public.user_scans
for insert
to authenticated
with check (
  (user_id is null and public.is_admin())
  or auth.uid() = user_id
);

create policy "reward events are readable by owner"
on public.reward_events
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "user badges are readable by owner"
on public.user_badges
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Admin workflows and curated catalog writes

create policy "admins can manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage product aliases"
on public.product_aliases
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage product images"
on public.product_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage barcodes"
on public.barcodes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage origins"
on public.origins
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage origin evidence"
on public.origin_evidence
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage nutrition"
on public.nutrition_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage recipes"
on public.recipes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage recipe products"
on public.recipe_products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage markets"
on public.markets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage market prices"
on public.market_prices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage retailer prices"
on public.retailer_prices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can read admin reviews"
on public.admin_reviews
for select
to authenticated
using (public.is_admin());

create policy "admins can manage admin reviews"
on public.admin_reviews
for insert
to authenticated
with check (public.is_admin());

create policy "admins can update admin reviews"
on public.admin_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage reward events"
on public.reward_events
for insert
to authenticated
with check (public.is_admin());

create policy "admins can update reward events"
on public.reward_events
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage badges"
on public.badges
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage user badges"
on public.user_badges
for insert
to authenticated
with check (public.is_admin());

create policy "admins can update user badges"
on public.user_badges
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can delete user badges"
on public.user_badges
for delete
to authenticated
using (public.is_admin());

commit;
