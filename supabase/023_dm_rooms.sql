-- メッセージのグループ（複数人の会話）・既読の位置・プッシュを押したときの画面
create table if not exists public.dm_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (length(name) <= 40),
  members uuid[] not null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create or replace function public.dm_in_room(r uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from dm_rooms where id = r and auth.uid() = any(members)) $$;
alter table public.dm_rooms enable row level security;
drop policy if exists room_sel on public.dm_rooms;
drop policy if exists room_ins on public.dm_rooms;
drop policy if exists room_upd on public.dm_rooms;
create policy room_sel on public.dm_rooms for select to authenticated using (auth.uid() = any(members));
create policy room_ins on public.dm_rooms for insert to authenticated with check (created_by = auth.uid() and auth.uid() = any(members) and public.is_approved() and cardinality(members) >= 2);
create policy room_upd on public.dm_rooms for update to authenticated using (auth.uid() = any(members)) with check (public.is_approved());

alter table public.dms add column if not exists room uuid references public.dm_rooms(id) on delete cascade;
alter table public.dms alter column to_id drop not null;
create index if not exists dms_room on public.dms (room, created_at desc);
drop policy if exists dm_sel on public.dms;
drop policy if exists dm_ins on public.dms;
create policy dm_sel on public.dms for select to authenticated using (auth.uid() = from_id or auth.uid() = to_id or (room is not null and public.dm_in_room(room)));
create policy dm_ins on public.dms for insert to authenticated with check (
  from_id = auth.uid() and public.is_approved() and (length(body) > 0 or cardinality(imgs) > 0) and (
    (room is null and to_id is not null and to_id <> auth.uid() and conv = public.dm_conv(from_id, to_id) and not public.dm_blocked(from_id, to_id))
    or (room is not null and to_id is null and conv = 'r-' || room::text and public.dm_in_room(room))));

create table if not exists public.dm_reads (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conv text not null,
  at timestamptz not null default now(),
  primary key (user_id, conv)
);
alter table public.dm_reads enable row level security;
drop policy if exists dmr_all on public.dm_reads;
create policy dmr_all on public.dm_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 写真：グループの会話は dm/r-<room>/<送った人>/…
drop policy if exists dm_obj_sel on storage.objects;
drop policy if exists dm_obj_ins on storage.objects;
create policy dm_obj_sel on storage.objects for select to authenticated using (bucket_id = 'dm' and (
  auth.uid()::text = any(string_to_array((storage.foldername(name))[1], '_'))
  or ((storage.foldername(name))[1] like 'r-%' and public.dm_in_room(substring((storage.foldername(name))[1] from 3)::uuid))));
create policy dm_obj_ins on storage.objects for insert to authenticated with check (bucket_id = 'dm' and public.is_approved() and (storage.foldername(name))[2] = auth.uid()::text and (
  auth.uid()::text = any(string_to_array((storage.foldername(name))[1], '_'))
  or ((storage.foldername(name))[1] like 'r-%' and public.dm_in_room(substring((storage.foldername(name))[1] from 3)::uuid))));

do $$ begin alter publication supabase_realtime add table public.dm_rooms; exception when duplicate_object then null; end $$;

-- プッシュ：運営の人は運営画面のメッセージへ、部員は部員アプリの会話へ
create or replace function public.dm_url(uid uuid, conv text) returns text language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from profiles where id = uid and coalesce(post, '—') <> '—') then './admin.html?go=dm:' || conv else './?dm=' || conv end $$;
create or replace function public.push_on_dm() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text; rn text; u uuid; txt text;
begin
  select name into nm from profiles where id = new.from_id;
  txt := case when new.body <> '' then left(new.body, 80) else '写真を送りました' end;
  if new.room is null then
    if exists (select 1 from profiles where id = new.to_id and ('dm' = any(notif_off) or 'dm' = any(notif_app))) then return new; end if;
    if public.dm_blocked(new.from_id, new.to_id) then return new; end if;
    perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nm, 'SLOPE'), 'body', txt, 'url', public.dm_url(new.to_id, new.from_id::text)));
  else
    select name into rn from dm_rooms where id = new.room;
    for u in select unnest(members) from dm_rooms where id = new.room loop
      if u = new.from_id then continue; end if;
      if exists (select 1 from profiles where id = u and ('dm' = any(notif_off) or 'dm' = any(notif_app))) then continue; end if;
      perform public.push_call(jsonb_build_object('to_id', u, 'title', coalesce(nullif(rn, ''), 'グループ'), 'body', coalesce(nm, '') || '：' || txt, 'url', public.dm_url(u, new.conv)));
    end loop;
  end if;
  return new;
end $$;
