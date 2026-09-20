-- StudyOS learning tracking v2: accurate watch-time, verified coverage and idempotent sessions.

alter table public.video_progress
  add column if not exists engaged_seconds integer not null default 0,
  add column if not exists content_seconds integer not null default 0,
  add column if not exists furthest_position_seconds integer not null default 0,
  add column if not exists verified_completion numeric(5,2) not null default 0,
  add column if not exists coverage_ranges jsonb not null default '[]'::jsonb,
  add column if not exists tracking_version smallint not null default 1,
  add column if not exists tracking_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='video_progress_engaged_seconds_check') then
    alter table public.video_progress add constraint video_progress_engaged_seconds_check check (engaged_seconds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_content_seconds_check') then
    alter table public.video_progress add constraint video_progress_content_seconds_check check (content_seconds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_furthest_position_seconds_check') then
    alter table public.video_progress add constraint video_progress_furthest_position_seconds_check check (furthest_position_seconds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_verified_completion_check') then
    alter table public.video_progress add constraint video_progress_verified_completion_check check (verified_completion >= 0 and verified_completion <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_coverage_ranges_check') then
    alter table public.video_progress add constraint video_progress_coverage_ranges_check check (jsonb_typeof(coverage_ranges) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_tracking_version_check') then
    alter table public.video_progress add constraint video_progress_tracking_version_check check (tracking_version between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname='video_progress_tracking_source_check') then
    alter table public.video_progress add constraint video_progress_tracking_source_check
      check (tracking_source is null or tracking_source = any(array['theater','extension','bookmark','smart_launch','manual']));
  end if;
end $$;

update public.video_progress
set furthest_position_seconds = greatest(
  coalesce(furthest_position_seconds,0),
  coalesce(last_position_seconds,0),
  coalesce(watched_seconds,0)
)
where furthest_position_seconds = 0;

create table if not exists public.video_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  client_session_id text not null,
  source text not null default 'theater',
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  ended_at timestamptz,
  engaged_seconds integer not null default 0,
  content_seconds integer not null default 0,
  coverage_seconds integer not null default 0,
  seek_count integer not null default 0,
  pause_count integer not null default 0,
  buffer_seconds integer not null default 0,
  last_position_seconds integer not null default 0,
  furthest_position_seconds integer not null default 0,
  playback_rate numeric(4,2) not null default 1,
  tracking_confidence numeric(4,3) not null default 1,
  coverage_ranges jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, video_id, client_session_id),
  constraint video_tracking_sessions_source_check check (source = any(array['theater','extension','bookmark','smart_launch','manual'])),
  constraint video_tracking_sessions_engaged_seconds_check check (engaged_seconds >= 0),
  constraint video_tracking_sessions_content_seconds_check check (content_seconds >= 0),
  constraint video_tracking_sessions_coverage_seconds_check check (coverage_seconds >= 0),
  constraint video_tracking_sessions_seek_count_check check (seek_count >= 0),
  constraint video_tracking_sessions_pause_count_check check (pause_count >= 0),
  constraint video_tracking_sessions_buffer_seconds_check check (buffer_seconds >= 0),
  constraint video_tracking_sessions_last_position_check check (last_position_seconds >= 0),
  constraint video_tracking_sessions_furthest_position_check check (furthest_position_seconds >= 0),
  constraint video_tracking_sessions_playback_rate_check check (playback_rate >= 0.25 and playback_rate <= 4),
  constraint video_tracking_sessions_tracking_confidence_check check (tracking_confidence >= 0 and tracking_confidence <= 1),
  constraint video_tracking_sessions_coverage_ranges_check check (jsonb_typeof(coverage_ranges) = 'array'),
  constraint video_tracking_sessions_client_id_check check (char_length(client_session_id) between 8 and 160)
);

create index if not exists video_tracking_sessions_user_video_last_event_idx
  on public.video_tracking_sessions(user_id, video_id, last_event_at desc);

alter table public.video_tracking_sessions enable row level security;

drop policy if exists "video_tracking_sessions_select_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_select_own" on public.video_tracking_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "video_tracking_sessions_insert_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_insert_own" on public.video_tracking_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "video_tracking_sessions_update_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_update_own" on public.video_tracking_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "video_tracking_sessions_delete_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_delete_own" on public.video_tracking_sessions
  for delete using (auth.uid() = user_id);
