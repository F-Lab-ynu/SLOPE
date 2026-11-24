-- プッシュ通知：端末ごとの宛先、通知ができたら送る、参加するイベントの前日20時にお知らせ
create extension if not exists pg_net;

create table if not exists public.push_subs (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists ps_sel on public.push_subs;
drop policy if exists ps_ins on public.push_subs;
drop policy if exists ps_upd on public.push_subs;
drop policy if exists ps_del on public.push_subs;
create policy ps_sel on public.push_subs for select using (user_id = auth.uid());
create policy ps_ins on public.push_subs for insert with check (user_id = auth.uid());
create policy ps_upd on public.push_subs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ps_del on public.push_subs for delete using (user_id = auth.uid());

-- 送るプログラムへの合い言葉（アプリからは読めない）
create table if not exists public.app_secrets (k text primary key, v text not null);
alter table public.app_secrets enable row level security;

create or replace function public.push_call(payload jsonb) returns void language plpgsql security definer set search_path = public as $$
declare key text;
begin
  select v into key from public.app_secrets where k = 'push_key';
  if key is null then return; end if;
  perform net.http_post(
    url := 'https://addvjcwwlklwmkwhhsjv.supabase.co/functions/v1/push',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', key));
end $$;
revoke all on function public.push_call(jsonb) from public, anon, authenticated;

create or replace function public.push_on_notif() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nullif(new.sub, ''), 'SLOPE'), 'body', new.text));
  return new;
end $$;
drop trigger if exists notif_push on public.notifications;
create trigger notif_push after insert on public.notifications for each row execute function public.push_on_notif();

-- 毎日20時（日本時間）：明日のイベントに参加登録した人へ
select cron.schedule('slope-remind', '0 11 * * *', $$select public.push_call('{"job":"remind"}'::jsonb)$$);
