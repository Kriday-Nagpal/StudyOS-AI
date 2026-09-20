
create index if not exists video_tracking_sessions_video_id_idx
  on public.video_tracking_sessions(video_id);

drop policy if exists "video_tracking_sessions_select_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_select_own"
  on public.video_tracking_sessions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "video_tracking_sessions_insert_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_insert_own"
  on public.video_tracking_sessions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "video_tracking_sessions_update_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_update_own"
  on public.video_tracking_sessions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "video_tracking_sessions_delete_own" on public.video_tracking_sessions;
create policy "video_tracking_sessions_delete_own"
  on public.video_tracking_sessions for delete
  using ((select auth.uid()) = user_id);
