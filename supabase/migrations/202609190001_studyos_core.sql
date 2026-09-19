create extension if not exists pgcrypto;

create type public.study_item_status as enum ('not_started','learning','needs_revision','strong','mastered');
create type public.document_status as enum ('uploaded','processing','needs_confirmation','confirmed','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  class_name text,
  board text,
  school text,
  timezone text not null default 'Asia/Kolkata',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  chapter_number integer,
  expected_minutes integer check (expected_minutes is null or expected_minutes > 0),
  status public.study_item_status not null default 'not_started',
  mastery smallint not null default 0 check (mastery between 0 and 100),
  is_new boolean not null default false,
  previously_tested boolean not null default false,
  priority numeric(6,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  name text not null,
  starts_at timestamptz not null,
  maximum_marks integer check (maximum_marks is null or maximum_marks > 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  readiness smallint not null default 0 check (readiness between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  title text not null,
  planned_for date not null,
  planned_minutes integer not null check (planned_minutes > 0),
  position integer not null default 0,
  reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  confidence smallint check (confidence is null or confidence between 1 and 5),
  questions_solved integer not null default 0 check (questions_solved >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.revision_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  revision_number smallint not null check (revision_number between 1 and 10),
  due_at timestamptz not null,
  completed_at timestamptz,
  recall_score smallint check (recall_score is null or recall_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  document_type text,
  subject_id uuid references public.subjects(id) on delete set null,
  status public.document_status not null default 'uploaded',
  extraction jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  question text not null,
  student_answer text,
  correct_answer text,
  mistake_type text not null,
  reattempted_at timestamptz,
  created_at timestamptz not null default now()
);

create index chapters_user_subject_idx on public.chapters(user_id,subject_id);
create index exams_user_starts_idx on public.exams(user_id,starts_at);
create index plan_user_date_idx on public.study_plan_items(user_id,planned_for,position);
create index sessions_user_started_idx on public.study_sessions(user_id,started_at desc);
create index revision_user_due_idx on public.revision_schedule(user_id,due_at) where completed_at is null;
create index documents_user_created_idx on public.documents(user_id,created_at desc);
create index mistakes_user_chapter_idx on public.mistakes(user_id,chapter_id);

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.exams enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.study_sessions enable row level security;
alter table public.revision_schedule enable row level security;
alter table public.documents enable row level security;
alter table public.mistakes enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','subjects','chapters','exams','study_plan_items','study_sessions','revision_schedule','documents','mistakes']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = %s)', t||'_select_own', t, case when t='profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = %s)', t||'_insert_own', t, case when t='profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = %s) with check ((select auth.uid()) = %s)', t||'_update_own', t, case when t='profiles' then 'id' else 'user_id' end, case when t='profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = %s)', t||'_delete_own', t, case when t='profiles' then 'id' else 'user_id' end);
  end loop;
end $$;

grant select,insert,update,delete on public.profiles,public.subjects,public.chapters,public.exams,public.study_plan_items,public.study_sessions,public.revision_schedule,public.documents,public.mistakes to authenticated;

insert into storage.buckets (id,name,public) values ('study-documents','study-documents',false) on conflict (id) do nothing;
create policy "documents_insert_own" on storage.objects for insert to authenticated with check (bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "documents_select_own" on storage.objects for select to authenticated using (bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "documents_update_own" on storage.objects for update to authenticated using (bucket_id='study-documents' and owner_id=(select auth.uid()::text)) with check (bucket_id='study-documents' and owner_id=(select auth.uid()::text));
create policy "documents_delete_own" on storage.objects for delete to authenticated using (bucket_id='study-documents' and owner_id=(select auth.uid()::text));
