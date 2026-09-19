-- Persist the student's active planning mode.
-- General mode works without exam data; exam mode overlays exam-aware prioritization.

alter table public.profiles
  add column if not exists study_mode text not null default 'general';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_study_mode_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_study_mode_check
      check (study_mode in ('general','exam'));
  end if;
end $$;
