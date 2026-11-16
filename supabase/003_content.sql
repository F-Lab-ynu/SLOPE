-- SLOPE：部員アプリと運営の共通コンテンツ
-- items     : 投稿・コメント・ペイン・部員からの情報・告知・トラック（kind で区別、中身は data）
-- reactions : 共感・いいね・参加登録・応募・修了・予定に追加（1人1種類につき1件）
-- reports   : 通報

create or replace function public.has_perm(tab text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and approved and (
      post = '代表'
      or (tab = 'projects' and post in ('教育部', '外務部 渉外局', '外務部 広報局', '催事部', '会計'))
      or (tab = 'tracks' and post = '教育部')
      or (tab = 'notices' and post in ('外務部 渉外局', '外務部 広報局'))
      or (tab = 'board' and post = '外務部 広報局')
    )
  );
$$;
create or replace function public.kind_perm(k text) returns text
language sql immutable as $$
  select case when k in ('recruit', 'idea', 'pain', 'other', 'comment') then 'board'
              when k in ('offer', 'notice') then 'notices'
              when k = 'track' then 'tracks' else 'none' end;
$$;

create table if not exists public.items (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer', 'notice', 'track')),
  parent_id text references public.items(id) on delete cascade,
  author uuid default auth.uid() references public.profiles(id) on delete set null,
  data jsonb not null default '{}',
  state text not null default 'ok' check (state in ('ok', 'hidden', 'deleted')),
  pos double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_kind_idx on public.items(kind, created_at desc);
create index if not exists items_parent_idx on public.items(parent_id);

create table if not exists public.reactions (
  item_id text not null,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id, kind)
);

create table if not exists public.reports (
  id bigserial primary key,
  item_id text not null references public.items(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

-- 投稿者は自分の投稿の公開状態（非表示・削除）を勝手に戻せない
create or replace function public.guard_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_perm(public.kind_perm(old.kind)) then
    new.state := old.state; new.kind := old.kind; new.author := old.author;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_item on public.items;
create trigger guard_item before update on public.items for each row execute function public.guard_item();

-- ロール（プレイヤーの職能）は本人が選べるようにする
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.post := old.post; new.approved := old.approved; new.email := old.email;
  end if;
  return new;
end $$;

alter table public.items enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;

drop policy if exists i_sel on public.items;
create policy i_sel on public.items for select using (
  public.is_approved() and (
    author = auth.uid()
    or public.has_perm(public.kind_perm(kind))
    or (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer') and state = 'ok')
    or (kind = 'notice' and state = 'ok' and data->>'state' = 'pub')
    or (kind = 'track' and state = 'ok' and data->>'status' = 'pub')
  ));
drop policy if exists i_ins on public.items;
create policy i_ins on public.items for insert with check (
  public.is_approved() and author = auth.uid() and (
    kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer')
    or public.has_perm(public.kind_perm(kind))
  ));
drop policy if exists i_upd on public.items;
create policy i_upd on public.items for update
  using (public.is_approved() and (author = auth.uid() or public.has_perm(public.kind_perm(kind))))
  with check (public.is_approved() and (author = auth.uid() or public.has_perm(public.kind_perm(kind))));
drop policy if exists i_del on public.items;
create policy i_del on public.items for delete using (public.is_approved() and (author = auth.uid() or public.has_perm(public.kind_perm(kind))));

drop policy if exists r_sel on public.reactions;
create policy r_sel on public.reactions for select using (public.is_approved());
drop policy if exists r_ins on public.reactions;
create policy r_ins on public.reactions for insert with check (public.is_approved() and user_id = auth.uid());
drop policy if exists r_del on public.reactions;
create policy r_del on public.reactions for delete using (user_id = auth.uid());

drop policy if exists rp_sel on public.reports;
create policy rp_sel on public.reports for select using (user_id = auth.uid() or public.has_perm('board'));
drop policy if exists rp_ins on public.reports;
create policy rp_ins on public.reports for insert with check (public.is_approved() and user_id = auth.uid());
drop policy if exists rp_del on public.reports;
create policy rp_del on public.reports for delete using (public.has_perm('board'));

grant select, insert, update, delete on public.items, public.reactions, public.reports to authenticated;
grant usage, select on sequence public.reports_id_seq to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reports; exception when duplicate_object then null; end;
end $$;
