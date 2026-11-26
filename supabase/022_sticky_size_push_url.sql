-- 付箋の大きさ／プッシュ通知を押したときに開く画面
alter table public.stickies add column if not exists w real;
alter table public.stickies add column if not exists h real;

-- 付箋などリンクのある通知は、押すとその画面（運営画面）へ
create or replace function public.push_on_notif() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'system' and exists (select 1 from public.profiles where id = new.to_id and new.kind = any(notif_app)) then return new; end if;
  perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nullif(new.sub, ''), 'SLOPE'), 'body', new.text,
    'url', case when coalesce(new.link, '') like 'sticky:%' then './admin.html?go=' || new.link else './' end));
  return new;
end $$;

-- DM は押すとその会話へ（部員アプリ）
create or replace function public.push_on_dm() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if exists (select 1 from profiles where id = new.to_id and ('dm' = any(notif_off) or 'dm' = any(notif_app))) then return new; end if;
  if public.dm_blocked(new.from_id, new.to_id) then return new; end if;
  select name into nm from profiles where id = new.from_id;
  perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nm, 'SLOPE'), 'body', case when new.body <> '' then left(new.body, 80) else '写真を送りました' end, 'url', './?dm=' || new.from_id));
  return new;
end $$;
