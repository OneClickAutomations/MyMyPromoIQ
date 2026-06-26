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
