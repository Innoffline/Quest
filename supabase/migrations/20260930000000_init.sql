-- Quest — initial schema
-- Every table is owned by a user (user_id default auth.uid()) and protected by RLS:
-- a signed-in user can only read and write their own rows.

-- gen_random_uuid() is built into Postgres 13+ (Supabase), no extension needed.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- settings (one row per user)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  week_start        smallint not null default 1 check (week_start in (0, 1)),
  level_base_xp     integer  not null default 100 check (level_base_xp > 0),
  level_step_xp     integer  not null default 20  check (level_step_xp >= 0),
  schedule_bonus_xp integer  not null default 5   check (schedule_bonus_xp >= 0),
  theme             text     not null default 'dark' check (theme in ('dark', 'light')),
  reduce_motion     boolean  not null default false,
  weight_unit       text     not null default 'lb' check (weight_unit in ('kg', 'lb')),
  updated_at        timestamptz not null default now()
);
create trigger user_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (the daily quest lines)
-- ---------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  icon            text not null default '⭐',
  description     text not null default '',
  normal_target   text not null default '',
  minimum_target  text not null default '',
  normal_xp       integer not null default 20 check (normal_xp >= 0),
  minimum_xp      integer not null default 10 check (minimum_xp >= 0),
  default_minutes integer not null default 60 check (default_minutes between 5 and 600),
  log_style       text not null default 'reason' check (log_style in ('food', 'reason')),
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index categories_user_idx on public.categories (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- daily plans (one per user per day; holds the day's note)
-- ---------------------------------------------------------------------------
create table public.daily_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- time blocks (planned quests)
-- ---------------------------------------------------------------------------
create table public.time_blocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null,
  category_id     uuid not null references public.categories (id) on delete cascade,
  title           text not null default '',
  start_time      time not null,
  end_time        time not null,
  planned_minutes integer not null default 60 check (planned_minutes >= 0),
  actual_minutes  integer check (actual_minutes >= 0),
  mode            text not null default 'normal' check (mode in ('normal', 'minimum')),
  status          text not null default 'planned'
                    check (status in ('planned', 'active', 'completed', 'partial', 'skipped')),
  notes           text not null default '',
  started_at      timestamptz,
  paused_at       timestamptz,
  paused_seconds  integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index time_blocks_user_date_idx on public.time_blocks (user_id, date, start_time);
create trigger time_blocks_updated before update on public.time_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- daily category completions (the daily score)
-- ---------------------------------------------------------------------------
create table public.daily_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null,
  category_id     uuid not null references public.categories (id) on delete cascade,
  completion_type text not null check (completion_type in ('normal', 'minimum', 'partial', 'incomplete')),
  completed_at    timestamptz not null default now(),
  xp_awarded      integer not null default 0 check (xp_awarded >= 0),
  unique (user_id, date, category_id)
);
create index daily_completions_user_date_idx on public.daily_completions (user_id, date);

-- ---------------------------------------------------------------------------
-- EXP ledger (amount is never negative — no EXP loss by design)
-- ---------------------------------------------------------------------------
create table public.xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  occurred_at timestamptz not null default now(),
  amount      integer not null check (amount >= 0),
  source_type text not null check (source_type in ('category', 'schedule_bonus')),
  source_id   uuid not null,
  description text not null default ''
);
create index xp_events_user_date_idx on public.xp_events (user_id, date);
create index xp_events_source_idx on public.xp_events (source_id);

create view public.user_xp_totals with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::bigint as total_xp
  from public.xp_events
  group by user_id;

-- ---------------------------------------------------------------------------
-- "What happened?" logs — structured for aggregation
-- ---------------------------------------------------------------------------
create table public.deviation_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  category_id   uuid not null references public.categories (id) on delete cascade,
  time_block_id uuid references public.time_blocks (id) on delete set null,
  item_label    text,   -- food / event (nutrition)
  trigger       text,   -- nutrition trigger, or reason for other categories
  context       text,
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index deviation_logs_user_date_idx on public.deviation_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- reusable quick-select tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('food', 'trigger', 'context', 'reason')),
  label       text not null check (char_length(label) between 1 and 60),
  category_id uuid references public.categories (id) on delete cascade,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index tags_user_idx on public.tags (user_id, kind);

-- ---------------------------------------------------------------------------
-- weekly review
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start      date not null,
  what_worked     text not null default '',
  next_adjustment text not null default '',
  created_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- outcome metrics (weight, applications, interviews, …)
-- ---------------------------------------------------------------------------
create table public.outcome_metrics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  metric_type   text not null check (metric_type in (
                  'weight', 'waist', 'applications_sent', 'recruiter_responses', 'referrals',
                  'interviews', 'networking', 'offers', 'workouts', 'active_minutes',
                  'interview_stages', 'health_note')),
  numeric_value double precision,
  text_value    text,
  created_at    timestamptz not null default now(),
  unique (user_id, date, metric_type)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only access on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings', 'categories', 'daily_plans', 'time_blocks', 'daily_completions',
    'xp_events', 'deviation_logs', 'tags', 'weekly_reviews', 'outcome_metrics'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)$p$, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

revoke all on public.user_xp_totals from anon;
grant select on public.user_xp_totals to authenticated;

-- Cross-row ownership: a user may only reference their own categories / blocks.
create or replace function public.assert_owned_category()
returns trigger language plpgsql security invoker as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category % does not belong to this user', new.category_id;
  end if;
  return new;
end $$;

create trigger time_blocks_owned_category before insert or update on public.time_blocks
  for each row execute function public.assert_owned_category();
create trigger daily_completions_owned_category before insert or update on public.daily_completions
  for each row execute function public.assert_owned_category();
create trigger deviation_logs_owned_category before insert or update on public.deviation_logs
  for each row execute function public.assert_owned_category();
create trigger tags_owned_category before insert or update on public.tags
  for each row execute function public.assert_owned_category();
