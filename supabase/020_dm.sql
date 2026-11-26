-- 部員同士の DM（本人どうしだけが読める。運営も読めない）。写真・既読・送信の取り消し・ブロック
create table if not exists public.dms (
  id uuid primary key default gen_random_uuid(),
  conv text not null,                                   -- 2人の id を小さい順に「_」でつないだもの
  from_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (length(body) <= 4000),
  imgs text[] not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists dms_conv on public.dms (conv, created_at desc);
create index if not exists dms_unread on public.dms (to_id) where read_at is null;

create table if not exists public.dm_blocks (
  blocker uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create or replace function public.dm_conv(a uuid, b uuid) returns text language sql immutable as $$
  select case when a::text < b::text then a::text || '_' || b::text else b::text || '_' || a::text end $$;
create or replace function public.dm_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from dm_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a)) $$;

alter table public.dms enable row level security;
alter table public.dm_blocks enable row level security;
drop policy if exists dm_sel on public.dms;
drop policy if exists dm_ins on public.dms;
drop policy if exists dm_upd on public.dms;
drop policy if exists dm_del on public.dms;
create policy dm_sel on public.dms for select to authenticated using (auth.uid() in (from_id, to_id));
create policy dm_ins on public.dms for insert to authenticated with check (
  from_id = auth.uid() and to_id <> auth.uid() and public.is_approved()
  and conv = public.dm_conv(from_id, to_id) and not public.dm_blocked(from_id, to_id)
  and (length(body) > 0 or cardinality(imgs) > 0));
create policy dm_upd on public.dms for update to authenticated using (to_id = auth.uid()) with check (to_id = auth.uid());
create policy dm_del on public.dms for delete to authenticated using (from_id = auth.uid());
-- 受け取った人が変えられるのは既読だけ
revoke update on public.dms from authenticated;
grant update (read_at) on public.dms to authenticated;

drop policy if exists dmb_sel on public.dm_blocks;
drop policy if exists dmb_ins on public.dm_blocks;
drop policy if exists dmb_del on public.dm_blocks;
create policy dmb_sel on public.dm_blocks for select to authenticated using (blocker = auth.uid());
create policy dmb_ins on public.dm_blocks for insert to authenticated with check (blocker = auth.uid() and blocked <> auth.uid());
create policy dmb_del on public.dm_blocks for delete to authenticated using (blocker = auth.uid());

do $$ begin alter publication supabase_realtime add table public.dms; exception when duplicate_object then null; end $$;

-- 届いたら相手にプッシュ（通知の設定で dm をオフにした人には送らない）
create or replace function public.push_on_dm() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if exists (select 1 from profiles where id = new.to_id and ('dm' = any(notif_off) or 'dm' = any(notif_app))) then return new; end if; -- オフ・アプリ内だけ
  if public.dm_blocked(new.from_id, new.to_id) then return new; end if;
  select name into nm from profiles where id = new.from_id;
  perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nm, 'SLOPE'), 'body', case when new.body <> '' then left(new.body, 80) else '写真を送りました' end));
  return new;
end $$;
drop trigger if exists dm_push on public.dms;
create trigger dm_push after insert on public.dms for each row execute function public.push_on_dm();

-- 写真：dm/<conv>/<送った人>/<ファイル>。その2人だけが見られる
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm', 'dm', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists dm_obj_sel on storage.objects;
drop policy if exists dm_obj_ins on storage.objects;
drop policy if exists dm_obj_del on storage.objects;
create policy dm_obj_sel on storage.objects for select to authenticated using (bucket_id = 'dm' and auth.uid()::text = any(string_to_array((storage.foldername(name))[1], '_')));
create policy dm_obj_ins on storage.objects for insert to authenticated with check (bucket_id = 'dm' and public.is_approved()
  and (storage.foldername(name))[2] = auth.uid()::text and auth.uid()::text = any(string_to_array((storage.foldername(name))[1], '_')));
create policy dm_obj_del on storage.objects for delete to authenticated using (bucket_id = 'dm' and owner = auth.uid());
