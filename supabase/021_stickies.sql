-- 付箋（短い期間だけのやり取り）とグループ（@で呼べる人のまとまり）
-- 運営（役職がある人）だけが使う。付箋は最後の書き込みから3日で消える
create or replace function public.is_ops() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and approved and coalesce(post, '—') <> '—') $$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  members uuid[] not null default '{}',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;
drop policy if exists grp_sel on public.groups;
drop policy if exists grp_all on public.groups;
create policy grp_sel on public.groups for select to authenticated using (public.is_ops());
create policy grp_all on public.groups for all to authenticated using (public.is_ops()) with check (public.is_ops());

create table if not exists public.stickies (
  id uuid primary key default gen_random_uuid(),
  place text not null,                -- 画面（view:フォルダーやファイルの id）
  label text not null default '',     -- 通知に出す場所の名前
  x real not null default 0.5, y real not null default 0.3,
  body text not null default '' check (length(body) <= 2000),
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mentions uuid[] not null default '{}',
  everyone boolean not null default false,
  color text not null default 'y',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sticky_msgs (
  id uuid primary key default gen_random_uuid(),
  sticky_id uuid not null references public.stickies(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists sticky_msgs_s on public.sticky_msgs (sticky_id, created_at);

create or replace function public.sticky_can(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from stickies where id = s and public.is_ops() and (author = auth.uid() or auth.uid() = any(mentions) or everyone)) $$;

alter table public.stickies enable row level security;
alter table public.sticky_msgs enable row level security;
drop policy if exists stk_sel on public.stickies;
drop policy if exists stk_ins on public.stickies;
drop policy if exists stk_upd on public.stickies;
drop policy if exists stk_del on public.stickies;
create policy stk_sel on public.stickies for select to authenticated using (public.is_ops() and (author = auth.uid() or auth.uid() = any(mentions) or everyone));
create policy stk_ins on public.stickies for insert to authenticated with check (public.is_ops() and author = auth.uid());
create policy stk_upd on public.stickies for update to authenticated using (public.is_ops() and (author = auth.uid() or auth.uid() = any(mentions) or everyone)) with check (public.is_ops());
create policy stk_del on public.stickies for delete to authenticated using (author = auth.uid() or public.is_admin());
drop policy if exists stm_sel on public.sticky_msgs;
drop policy if exists stm_ins on public.sticky_msgs;
drop policy if exists stm_del on public.sticky_msgs;
create policy stm_sel on public.sticky_msgs for select to authenticated using (public.sticky_can(sticky_id));
create policy stm_ins on public.sticky_msgs for insert to authenticated with check (author = auth.uid() and public.sticky_can(sticky_id));
create policy stm_del on public.sticky_msgs for delete to authenticated using (author = auth.uid());

-- 返信が付いたら付箋の「最後の書き込み」を新しくする
create or replace function public.sticky_touch() returns trigger language plpgsql security definer set search_path = public as $$
begin update stickies set updated_at = now() where id = new.sticky_id; return new; end $$;
drop trigger if exists sticky_touch on public.sticky_msgs;
create trigger sticky_touch after insert on public.sticky_msgs for each row execute function public.sticky_touch();

-- 通知から付箋へ飛べるように
alter table public.notifications add column if not exists link text not null default '';

-- 新しく呼ばれた人へ知らせる
create or replace function public.sticky_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text; add uuid[];
begin
  add := array(select unnest(new.mentions) except select unnest(case when tg_op = 'UPDATE' then old.mentions else '{}'::uuid[] end));
  if cardinality(add) = 0 then return new; end if;
  select name into nm from profiles where id = auth.uid();
  insert into notifications (to_id, text, sub, kind, link)
  select u, coalesce(nm, '') || 'さんが付箋で呼んでいます：' || left(new.body, 40), new.label, 'sticky', 'sticky:' || new.id
  from unnest(add) u where u is distinct from auth.uid();
  return new;
end $$;
drop trigger if exists sticky_notify on public.stickies;
create trigger sticky_notify after insert or update of mentions on public.stickies for each row execute function public.sticky_notify();

do $$ begin alter publication supabase_realtime add table public.stickies; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.sticky_msgs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.groups; exception when duplicate_object then null; end $$;

-- 最後の書き込みから3日で消す（毎時）
select cron.unschedule('slope-stickies') where exists (select 1 from cron.job where jobname = 'slope-stickies');
select cron.schedule('slope-stickies', '7 * * * *', $$delete from public.stickies where updated_at < now() - interval '3 days'$$);
