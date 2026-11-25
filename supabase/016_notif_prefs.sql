-- 通知の設定：受け取る種類を選ぶ／長押しで「この種類」「このイベント・フォルダー」を非通知にする
--  kind: assign（担当・メンバー）/ done（業務の完了）/ event（参加するイベント）/ reply（お問い合わせの返信）/ system（運営からの連絡・止められない）
alter table public.profiles add column if not exists notif_off text[] not null default '{}';   -- 受け取らない種類
alter table public.profiles add column if not exists notif_mute text[] not null default '{}';  -- 受け取らないイベント・フォルダー名
alter table public.notifications add column if not exists kind text not null default '';

-- 文面から種類を決める（古いアプリから届いた通知にも使う）
create or replace function public.notif_kind(t text) returns text language sql immutable as $$
  select case
    when t ~ '」の(担当|メンバー|リーダー)になりました$' then 'assign'
    when t ~ '(を完了しました|がすべて完了しました)$' then 'done'
    when t ~ '^お問い合わせに返信' then 'reply'
    when t ~ '^「.*」(は中止になりました|の日時・場所が変わりました)$' or t ~ '^明日：' then 'event'
    else 'system' end $$;
-- 通知の出どころ（長押しで止める単位）：イベントの知らせはそのイベント名、業務はいちばん上のフォルダー名
create or replace function public.notif_src(t text, s text, k text) returns text language sql immutable as $$
  select case when k = 'event' then coalesce(substring(t from '^「(.*)」'), substring(t from '^明日：(.*)$'), '') else coalesce(s, '') end $$;

create or replace function public.notif_filter() returns trigger language plpgsql security definer set search_path = public as $$
declare o text[]; m text[]; src text;
begin
  if coalesce(new.kind, '') = '' then new.kind := public.notif_kind(new.text); end if;
  if new.kind = 'system' then return new; end if;
  select notif_off, notif_mute into o, m from public.profiles where id = new.to_id;
  src := public.notif_src(new.text, new.sub, new.kind);
  if new.kind = any(coalesce(o, '{}')) or (src <> '' and src = any(coalesce(m, '{}'))) then return null; end if; -- 止めている → 作らない（プッシュも飛ばない）
  return new;
end $$;
drop trigger if exists notif_filter on public.notifications;
create trigger notif_filter before insert on public.notifications for each row execute function public.notif_filter();
