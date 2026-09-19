-- StudyOS learning library and engagement layer
-- Mirrors the additive migration applied to the connected StudyOS AI Supabase project.

create table if not exists public.study_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.curriculum_chapters(id) on delete set null,
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  resource_type text not null check (resource_type in ('note','pdf','video','website','worksheet','question_paper','flashcards','other')),
  url text,
  storage_path text,
  source_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.curriculum_chapters(id) on delete set null,
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  provider text not null default 'other' check (provider in ('youtube','diksha','khan_academy','school','other')),
  external_id text,
  title text not null,
  url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  classification_confidence numeric not null default 0 check (classification_confidence between 0 and 1),
  user_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, provider, external_id)
);

create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completion numeric not null default 0 check (completion between 0 and 100),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  sessions integer not null default 0 check (sessions >= 0),
  confidence smallint check (confidence is null or confidence between 1 and 5),
  last_watched_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, video_id)
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.curriculum_chapters(id) on delete set null,
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  front text not null,
  back text not null,
  source_kind text not null default 'user' check (source_kind in ('user','uploaded_document','ai_generated','mistake')),
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  rating text not null check (rating in ('forgot','hard','good','easy')),
  reviewed_at timestamptz not null default now(),
  next_due_at timestamptz,
  interval_days integer not null default 1 check (interval_days >= 0)
);

create table if not exists public.doubts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.curriculum_chapters(id) on delete set null,
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  title text not null,
  detail text,
  status text not null default 'unresolved' check (status in ('unresolved','explained','practice_needed','resolved')),
  source_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_enabled boolean not null default true,
  email_enabled boolean not null default false,
  revision_enabled boolean not null default true,
  homework_enabled boolean not null default true,
  exam_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);

create index if not exists study_resources_user_created_idx on public.study_resources(user_id, created_at desc);
create index if not exists videos_user_subject_idx on public.videos(user_id, subject_id);
create index if not exists video_progress_user_updated_idx on public.video_progress(user_id, updated_at desc);
create index if not exists flashcards_user_topic_idx on public.flashcards(user_id, topic_id);
create index if not exists flashcard_reviews_due_idx on public.flashcard_reviews(user_id, next_due_at);
create index if not exists doubts_user_status_idx on public.doubts(user_id, status, created_at desc);

alter table public.study_resources enable row level security;
alter table public.videos enable row level security;
alter table public.video_progress enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.doubts enable row level security;
alter table public.notification_preferences enable row level security;

do $$
declare t text;
begin
  foreach t in array array['study_resources','videos','video_progress','flashcards','flashcard_reviews','doubts']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t||'_delete_own', t);
  end loop;
end $$;

create policy notification_preferences_select_own on public.notification_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notification_preferences_delete_own on public.notification_preferences for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.study_resources, public.videos, public.video_progress, public.flashcards, public.flashcard_reviews, public.doubts, public.notification_preferences to authenticated;
