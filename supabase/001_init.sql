-- SLOPE 運営：初期スキーマ
-- profiles: 部員（承認制）／ nodes: 業務ツリー（イベント→部→チーム→個人）／ notifications: 個人通知

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  grade text not null default '',
  post text not null default '—',          -- 役職（代表・教育部・…・— はプレイヤー）
  roles text[] not null default '{}',       -- プレイヤーのロール
  approved boolean not null default false,  -- 運営の承認
  created_at timestamptz not null default now()
);

create table if not exists public.nodes (
  id text primary key,
  parent_id text references public.nodes(id) on delete cascade deferrable initially deferred,
  pos double precision not null default 0,
  title text not null default '',
  kind text,               -- ルートのみ: event | work
  announce text,           -- ルートのみ: before | done
  reg integer,             -- ルートのみ: 参加登録数
  unit text,               -- ルートのみ: 担当部
  who uuid references public.profiles(id) on delete set null,   -- 担当（グループではリーダー）
  team uuid[] not null default '{}',                            -- メンバー（個人の段では未使用）
  start_date date not null default current_date,
  end_date date not null default current_date,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists nodes_parent_idx on public.nodes(parent_id);

create table if not exists public.notifications (
  id bigserial primary key,
  to_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  sub text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_to_idx on public.notifications(to_id, created_at desc);

-- ---------- 判定用の関数（RLS の再帰を避けるため security definer） ----------
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and approved);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and approved and post = '代表');
$$;
-- 自分が「その業務か、その上のどこか」の担当（リーダー）なら編集できる
create or replace function public.can_edit(node text) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive up as (
    select id, parent_id, who from nodes where id = node
    union all
    select n.id, n.parent_id, n.who from nodes n join up on n.id = up.parent_id
  )
  select public.is_approved() and exists (select 1 from up where who = auth.uid());
$$;

-- ---------- 新規ユーザー：プロフィールを作る（最初の1人は代表として承認済み） ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first boolean;
begin
  select not exists (select 1 from profiles) into first;
  insert into profiles (id, name, email, post, approved)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          coalesce(new.email, ''),
          case when first then '代表' else '—' end,
          first);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 代表以外は自分の役職・承認・ロールを変えられない
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.post := old.post; new.approved := old.approved; new.roles := old.roles; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

create or replace function public.touch_node() returns trigger
language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists touch_node on public.nodes;
create trigger touch_node before insert or update on public.nodes for each row execute function public.touch_node();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.nodes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select using (id = auth.uid() or public.is_admin() or (public.is_approved() and approved));
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists p_del on public.profiles;
create policy p_del on public.profiles for delete using (public.is_admin() and id <> auth.uid());

drop policy if exists n_sel on public.nodes;
create policy n_sel on public.nodes for select using (public.is_approved());
drop policy if exists n_ins on public.nodes;
create policy n_ins on public.nodes for insert with check (public.is_admin() or (parent_id is not null and public.can_edit(parent_id)));
drop policy if exists n_upd on public.nodes;
create policy n_upd on public.nodes for update
  using (public.is_admin() or public.can_edit(id))
  with check (public.is_admin() or (parent_id is not null and public.can_edit(parent_id)) or who = auth.uid() or public.can_edit(id));
drop policy if exists n_del on public.nodes;
create policy n_del on public.nodes for delete using (public.is_admin() or (parent_id is not null and public.can_edit(parent_id)));

drop policy if exists t_sel on public.notifications;
create policy t_sel on public.notifications for select using (to_id = auth.uid());
drop policy if exists t_ins on public.notifications;
create policy t_ins on public.notifications for insert with check (public.is_approved());
drop policy if exists t_upd on public.notifications;
create policy t_upd on public.notifications for update using (to_id = auth.uid());

grant select, insert, update, delete on public.profiles, public.nodes, public.notifications to authenticated;
grant usage, select on sequence public.notifications_id_seq to authenticated;

-- ---------- リアルタイム ----------
do $$ begin
  begin alter publication supabase_realtime add table public.nodes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;
