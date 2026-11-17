-- アクセス記録：部員が画面を開いた記録。中身を見られるのは代表だけ（集計関数経由）
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  app text not null check (app in ('member', 'admin')),
  tab text not null default 'open',
  at timestamptz not null default now()
);
create index if not exists visits_at_idx on public.visits(at);
alter table public.visits enable row level security;
drop policy if exists v_ins on public.visits;
create policy v_ins on public.visits for insert with check (public.is_approved() and user_id = auth.uid());

create or replace function public.visit_stats(days int default 14) returns json
language plpgsql stable security definer set search_path = public as $$
declare tz text := 'Asia/Tokyo'; today date := (now() at time zone tz)::date; r json;
begin
  if not public.has_perm('admin') then raise exception 'not allowed'; end if;
  select json_build_object(
    'days', (select coalesce(json_agg(json_build_object('day', d::date, 'users', coalesce(x.u, 0), 'views', coalesce(x.v, 0)) order by d), '[]')
             from generate_series(today - (days - 1), today, interval '1 day') d
             left join (select (at at time zone tz)::date dd, count(distinct user_id) u, count(*) v from visits where at > now() - make_interval(days => days + 1) group by 1) x on x.dd = d::date),
    'dau', (select count(distinct user_id) from visits where (at at time zone tz)::date = today),
    'wau', (select count(distinct user_id) from visits where at > now() - interval '7 days'),
    'mau', (select count(distinct user_id) from visits where at > now() - interval '30 days'),
    'total', (select count(*) from profiles where approved),
    'tabs', (select coalesce(json_agg(t), '[]') from (select app, tab, count(*) views, count(distinct user_id) users from visits where at > now() - interval '30 days' and tab <> 'open' group by app, tab) t)
  ) into r;
  return r;
end $$;
grant execute on function public.visit_stats(int) to authenticated;
