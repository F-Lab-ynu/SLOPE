-- 通知：自分あての通知は自分で削除できる
drop policy if exists t_del on public.notifications;
create policy t_del on public.notifications for delete using (to_id = auth.uid());
