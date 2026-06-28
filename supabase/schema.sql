-- ─────────────────────────────────────────────────────────────────────────────
-- MyPromoIQ — Supabase schema
-- Run this in the Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- campaigns — the top-level unit of work (one product, one campaign)
create table if not exists campaigns (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,           -- Clerk user ID (e.g. user_2abc...)
  name             text not null default 'Untitled Campaign',
  product_image_url text,
  product_description text,
  style            text,
  quality          text not null default 'turbo',
  status           text not null default 'draft', -- draft|rendering|ready|published
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- scenes — individual storyboard beats within a campaign
create table if not exists scenes (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  user_id          text not null,           -- denormalized for RLS simplicity
  label            text not null,           -- "Hook", "Testimonial", etc.
  style            text not null,
  order_index      integer not null default 0,
  phase            text not null default 'idle', -- idle|working|done|error
  request_id       text,                    -- provider job id (for polling)
  director_prompt  text,
  video_url        text,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists campaigns_user_id_idx on campaigns(user_id);
create index if not exists campaigns_created_at_idx on campaigns(created_at desc);
create index if not exists scenes_campaign_id_idx on scenes(campaign_id);
create index if not exists scenes_order_idx on scenes(campaign_id, order_index);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Users can only see and modify their own data.
-- auth.jwt() ->> 'sub' returns the Clerk user_id from the Bearer token.

alter table campaigns enable row level security;
alter table scenes    enable row level security;

drop policy if exists "own campaigns" on campaigns;
create policy "own campaigns" on campaigns
  for all using ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own scenes" on scenes;
create policy "own scenes" on scenes
  for all using ((auth.jwt() ->> 'sub') = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Commercial Studio (CreativeBrief wizard) — Phase 0 data layer.
-- Keyed to user_id now so future features (Brand Kits, Creative History, Bulk
-- Campaigns) are additive, not a re-architecture. Server writes use the service
-- key (see /api/store) which bypasses RLS; the policies below also allow direct
-- client access once the Clerk↔Supabase JWT bridge is configured.
-- ─────────────────────────────────────────────────────────────────────────────

-- creative_briefs — the single source of truth for one wizard session.
create table if not exists creative_briefs (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  status      text not null default 'draft', -- draft|storyboard_review|rendering|complete|failed
  product     jsonb not null default '{}'::jsonb,
  creator     jsonb not null default '{}'::jsonb,
  scene       jsonb not null default '{}'::jsonb,
  style       jsonb not null default '{}'::jsonb,
  voice       jsonb not null default '{}'::jsonb,
  script      jsonb not null default '{}'::jsonb,
  storyboard  jsonb not null default '{}'::jsonb,
  render      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- creators — saved, reusable on-camera identities ("My Cast").
create table if not exists creators (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null default 'Untitled Creator',
  mode        text not null default 'generated', -- generated|uploaded_seed
  attributes  jsonb,
  seed_images jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- product_assets — raw + processed images, keyed to a brief or standalone.
create table if not exists product_assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  brief_id    uuid references creative_briefs(id) on delete set null,
  kind        text not null default 'raw',       -- raw|processed
  url         text not null,
  width       integer,
  height      integer,
  mime_type   text,
  created_at  timestamptz not null default now()
);

-- render_jobs — 1:1 with a brief's render; carries the live director status log.
create table if not exists render_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  brief_id     uuid not null references creative_briefs(id) on delete cascade,
  provider_job_id text,
  status       text not null default 'queued',   -- queued|rendering|complete|failed
  status_log   jsonb not null default '[]'::jsonb,
  payload      jsonb,
  output_url   text,
  credits_cost integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- campaign_templates — future feature; schema now so it's additive later.
create table if not exists campaign_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null default 'Untitled Template',
  brief       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists creative_briefs_user_idx on creative_briefs(user_id);
create index if not exists creative_briefs_status_idx on creative_briefs(status);
create index if not exists creators_user_idx on creators(user_id);
create index if not exists product_assets_user_idx on product_assets(user_id);
create index if not exists product_assets_brief_idx on product_assets(brief_id);
create index if not exists render_jobs_brief_idx on render_jobs(brief_id);
create index if not exists campaign_templates_user_idx on campaign_templates(user_id);

alter table creative_briefs   enable row level security;
alter table creators          enable row level security;
alter table product_assets    enable row level security;
alter table render_jobs       enable row level security;
alter table campaign_templates enable row level security;

drop policy if exists "own briefs" on creative_briefs;
create policy "own briefs" on creative_briefs for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own creators" on creators;
create policy "own creators" on creators for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own product_assets" on product_assets;
create policy "own product_assets" on product_assets for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own render_jobs" on render_jobs;
create policy "own render_jobs" on render_jobs for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own campaign_templates" on campaign_templates;
create policy "own campaign_templates" on campaign_templates for all using ((auth.jwt() ->> 'sub') = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaigns_updated_at on campaigns;
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

drop trigger if exists scenes_updated_at on scenes;
create trigger scenes_updated_at
  before update on scenes
  for each row execute function set_updated_at();

drop trigger if exists creative_briefs_updated_at on creative_briefs;
create trigger creative_briefs_updated_at
  before update on creative_briefs
  for each row execute function set_updated_at();

drop trigger if exists creators_updated_at on creators;
create trigger creators_updated_at
  before update on creators
  for each row execute function set_updated_at();

drop trigger if exists render_jobs_updated_at on render_jobs;
create trigger render_jobs_updated_at
  before update on render_jobs
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Creative Studio — reusable asset library (product profiles, brand kits).
-- creators table already exists above; product_profiles and brand_kits are new.
-- ─────────────────────────────────────────────────────────────────────────────

-- product_profiles — standalone product entities (reused across campaigns).
create table if not exists product_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  name               text not null default 'Untitled Product',
  brand              text,
  category           text,
  primary_image_url  text,
  images             jsonb not null default '[]'::jsonb,
  description        text,
  features           jsonb not null default '[]'::jsonb,
  benefits           jsonb not null default '[]'::jsonb,
  target_audience    text,
  logo_url           text,
  colors             jsonb not null default '[]'::jsonb,
  default_prompt     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- brand_kits — brand identity, voice, and guidelines.
create table if not exists brand_kits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  name               text not null default 'My Brand',
  logo_url           text,
  primary_colors     jsonb not null default '[]'::jsonb,
  secondary_colors   jsonb not null default '[]'::jsonb,
  brand_voice        text,
  taglines           jsonb not null default '[]'::jsonb,
  target_audience    text,
  industry           text,
  brand_guidelines   text,
  cta_preferences    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists product_profiles_user_idx on product_profiles(user_id);
create index if not exists brand_kits_user_idx on brand_kits(user_id);

alter table product_profiles enable row level security;
alter table brand_kits       enable row level security;

drop policy if exists "own product_profiles" on product_profiles;
create policy "own product_profiles" on product_profiles for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own brand_kits" on brand_kits;
create policy "own brand_kits" on brand_kits for all using ((auth.jwt() ->> 'sub') = user_id);

drop trigger if exists product_profiles_updated_at on product_profiles;
create trigger product_profiles_updated_at
  before update on product_profiles
  for each row execute function set_updated_at();

drop trigger if exists brand_kits_updated_at on brand_kits;
create trigger brand_kits_updated_at
  before update on brand_kits
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Discovery Engine & Clone Bridge (Phase 2 data layer)
--
-- Apify runs and sourcing lookups cost real money per call, so ad_searches and
-- sourcing_lookups double as caches: check them before any new external call.
-- All additive — nothing here changes the existing studio pipeline.
-- ─────────────────────────────────────────────────────────────────────────────

-- source_ads — scored ads discovered via the research flow.
create table if not exists source_ads (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  platform           text not null,            -- 'meta' | 'tiktok'
  external_ad_id     text,
  page_or_shop_name  text,
  creative           jsonb not null default '{}'::jsonb,
  delivery           jsonb not null default '{}'::jsonb,
  product            jsonb not null default '{}'::jsonb,
  score              jsonb not null default '{}'::jsonb,
  raw_payload        jsonb,                     -- full actor output for re-scoring/debug
  fetched_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- ad_searches — one row per search; also a cache keyed on (query, platform, day).
create table if not exists ad_searches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  query_type         text not null,            -- 'keyword' | 'product_url'
  query_value        text not null,
  platform           text not null,            -- 'meta' | 'tiktok' | 'both'
  date_bucket        date not null default current_date,
  apify_run_id       text,
  status             text not null default 'queued',
  result_count       int not null default 0,
  results            jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

-- sourcing_lookups — cache of dropship matches keyed on a normalized product name.
create table if not exists sourcing_lookups (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  normalized_name    text not null,
  result             jsonb,                     -- SourcingResult, or null when no match
  expires_at         timestamptz not null default (now() + interval '7 days'),
  created_at         timestamptz not null default now()
);

-- creative_briefs gains an additive sourceAd column (cloned-from-ad provenance).
alter table creative_briefs add column if not exists source_ad jsonb;

create index if not exists source_ads_user_idx       on source_ads(user_id);
create index if not exists ad_searches_user_idx       on ad_searches(user_id);
create index if not exists ad_searches_cache_idx       on ad_searches(query_value, platform, date_bucket);
create index if not exists sourcing_lookups_name_idx   on sourcing_lookups(normalized_name);

alter table source_ads       enable row level security;
alter table ad_searches      enable row level security;
alter table sourcing_lookups enable row level security;

drop policy if exists "own source_ads" on source_ads;
create policy "own source_ads" on source_ads for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own ad_searches" on ad_searches;
create policy "own ad_searches" on ad_searches for all using ((auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own sourcing_lookups" on sourcing_lookups;
create policy "own sourcing_lookups" on sourcing_lookups for all using ((auth.jwt() ->> 'sub') = user_id);
