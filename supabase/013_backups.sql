-- 毎週日曜の朝4時（日本時間）に、全部のデータを1つにまとめて保存する。8週分だけ残す。
-- アプリからは誰も読めない（Supabaseのダッシュボードでのみ見られる）
create extension if not exists pg_cron;

create table if not exists public.backups (
  id bigserial primary key,
  taken_at timestamptz not null default now(),
  data jsonb not null
);
alter table public.backups enable row level security; -- 方針を作らない＝アプリからは読めない

create or replace function public.take_backup() returns void language sql security definer set search_path = public as $$
  insert into public.backups(data) select jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(t) from public.profiles t), '[]'),
    'nodes', coalesce((select jsonb_agg(t) from public.nodes t), '[]'),
    'items', coalesce((select jsonb_agg(t) from public.items t), '[]'),
    'reactions', coalesce((select jsonb_agg(t) from public.reactions t), '[]'),
    'notifications', coalesce((select jsonb_agg(t) from public.notifications t), '[]'),
    'reports', coalesce((select jsonb_agg(t) from public.reports t), '[]'),
    'cal_tokens', coalesce((select jsonb_agg(t) from public.cal_tokens t), '[]'));
  -- 8週より古い控えだけを消す（控えのテーブルの中だけ。ほかのデータには触らない）
  delete from public.backups where taken_at < now() - interval '8 weeks';
$$;
revoke all on function public.take_backup() from public, anon, authenticated;

select cron.schedule('slope-backup', '0 19 * * 6', 'select public.take_backup()'); -- UTC 土曜19時＝日本時間 日曜4時
select public.take_backup(); -- 最初の1回
