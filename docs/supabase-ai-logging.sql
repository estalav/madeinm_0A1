begin;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  route text not null,
  request_kind text not null,
  success boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  image_count integer,
  catalog_candidates integer,
  barcode_value text,
  visual_guess text,
  matched_product_name text,
  reasoning text,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_usage_logs_created_at on public.ai_usage_logs (created_at desc);
create index if not exists idx_ai_usage_logs_success on public.ai_usage_logs (success);
create index if not exists idx_ai_usage_logs_model on public.ai_usage_logs (model);

commit;
