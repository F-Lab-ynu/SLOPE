-- 通知 v2：部員向け／運営向けの種類、種類ごとに「プッシュ・アプリ内・オフ」、期限の知らせ（日数は本人が選ぶ）、運営への知らせはその画面を担当する人へ
--  016_notif_prefs.sql を先に当てること（列と関数を作り直すので、016 のあとならいつ当ててもよい）
--  部員向け: remind（参加するイベントの前日）/ evchange（中止・変更）/ evnew（新しいイベント）/ comment（自分の投稿へのコメント）/ offer_ok（共有した外部告知が公式に）/ reply（お問い合わせの返信）
--  運営向け: assign（担当・メンバー）/ done（業務の完了）/ due（期限が近い）/ late（期限切れ）/ inquiry（お問い合わせ）/ report（通報）/ offer_wait（外部告知の確認待ち）
--  system（運営からの連絡）は止められない
alter table public.profiles add column if not exists notif_off text[] not null default '{}';    -- オフ
alter table public.profiles add column if not exists notif_app text[] not null default '{done}'; -- アプリ内だけ（プッシュしない）。ほかはプッシュ
alter table public.profiles add column if not exists notif_mute text[] not null default '{}';   -- 止めているイベント・フォルダー名
alter table public.profiles add column if not exists notif_due int[] not null default '{3,0}';  -- 期限の何日前に知らせるか（0＝当日）
alter table public.notifications add column if not exists kind text not null default '';
-- 016 の「event」を2つに分ける
update public.profiles set notif_off = array_remove(notif_off, 'event') || '{remind,evchange}'::text[] where 'event' = any(notif_off);

create or replace function public.notif_kind(t text) returns text language sql immutable as $$
  select case
    when t ~ '」の(担当|メンバー|リーダー)になりました$' then 'assign'
    when t ~ '(を完了しました|がすべて完了しました)$' then 'done'
    when t ~ '^お問い合わせに返信' then 'reply'
    when t ~ '^「.*」(は中止になりました|の日時・場所が変わりました)$' then 'evchange'
    when t ~ '^明日：' then 'remind'
    else 'system' end $$;
create or replace function public.notif_src(t text, s text, k text) returns text language sql immutable as $$
  select case when k in ('remind', 'evchange', 'evnew') then coalesce(substring(t from '「(.*)」'), substring(t from '^明日：(.*)$'), '')
              when k in ('assign', 'done', 'due', 'late') then coalesce(s, '') else '' end $$;

create or replace function public.notif_filter() returns trigger language plpgsql security definer set search_path = public as $$
declare o text[]; m text[]; src text;
begin
  if coalesce(new.kind, '') = '' then new.kind := public.notif_kind(new.text); end if;
  if new.kind = 'system' then return new; end if;
  select notif_off, notif_mute into o, m from public.profiles where id = new.to_id;
  src := public.notif_src(new.text, new.sub, new.kind);
  if new.kind = any(coalesce(o, '{}')) or (src <> '' and src = any(coalesce(m, '{}'))) then return null; end if;
  return new;
end $$;
drop trigger if exists notif_filter on public.notifications;
create trigger notif_filter before insert on public.notifications for each row execute function public.notif_filter();

-- 「アプリ内だけ」の種類はプッシュしない
create or replace function public.push_on_notif() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'system' and exists (select 1 from public.profiles where id = new.to_id and new.kind = any(notif_app)) then return new; end if;
  perform public.push_call(jsonb_build_object('to_id', new.to_id, 'title', coalesce(nullif(new.sub, ''), 'SLOPE'), 'body', new.text));
  return new;
end $$;

-- 役職ごとの画面（has_perm と同じ決め方を、ほかの人について見る）
create or replace function public.post_has(p text, tab text) returns boolean language sql immutable as $$
  select p = '代表'
    or (tab = 'projects' and p in ('教育部', '外務部 渉外局', '外務部 広報局', '催事部', '会計'))
    or (tab = 'tracks' and p = '教育部')
    or (tab = 'notices' and p in ('外務部 渉外局', '外務部 広報局'))
    or (tab = 'board' and p = '外務部 広報局') $$;
create or replace function public.notif_to_tab(tab text, k text, t text, s text, skip uuid) returns void language sql security definer set search_path = public as $$
  insert into notifications (to_id, text, sub, kind)
  select id, t, coalesce(s, ''), k from profiles where approved and public.post_has(post, tab) and id is distinct from skip $$;
revoke all on function public.notif_to_tab(text, text, text, text, uuid) from public, anon, authenticated;

-- お問い合わせ → サポートの担当
create or replace function public.notif_inq() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notif_to_tab('board', 'inquiry', '新しいお問い合わせ（' || new.kind || '）', left(new.body, 40), new.user_id);
  return new;
end $$;
drop trigger if exists notif_inq on public.inquiries;
create trigger notif_inq after insert on public.inquiries for each row execute function public.notif_inq();

-- 通報 → 掲示板の担当
create or replace function public.notif_report() returns trigger language plpgsql security definer set search_path = public as $$
declare ttl text;
begin
  select coalesce(nullif(data->>'title', ''), left(coalesce(data->>'text', ''), 20)) into ttl from public.items where id = new.item_id;
  perform public.notif_to_tab('board', 'report', '投稿が通報されました：「' || coalesce(ttl, '') || '」', new.reason, new.user_id);
  return new;
end $$;
drop trigger if exists notif_report on public.reports;
create trigger notif_report after insert on public.reports for each row execute function public.notif_report();

-- 投稿まわり：コメント → 投稿した人／外部告知の共有 → 告知の担当、公式になったら共有した人／イベントの公開 → 全員
create or replace function public.notif_items() returns trigger language plpgsql security definer set search_path = public as $$
declare pa uuid; pt text; ttl text := coalesce(nullif(new.data->>'title', ''), left(coalesce(new.data->>'text', ''), 20));
begin
  if tg_op = 'INSERT' and new.kind = 'comment' and new.parent_id is not null then
    select author, coalesce(nullif(data->>'title', ''), left(coalesce(data->>'text', ''), 20)) into pa, pt from public.items where id = new.parent_id;
    if pa is not null and pa is distinct from new.author then
      insert into public.notifications (to_id, text, sub, kind) values (pa, '「' || coalesce(pt, '') || '」にコメントが付きました', left(coalesce(new.data->>'text', ''), 40), 'comment');
    end if;
  end if;
  if new.kind = 'offer' then
    if tg_op = 'INSERT' and coalesce(new.data->>'state', 'wait') = 'wait' then
      perform public.notif_to_tab('notices', 'offer_wait', '外部告知の確認待ち：「' || ttl || '」', coalesce(new.data->>'type', ''), new.author);
    elsif tg_op = 'UPDATE' and new.data->>'state' = 'ok' and coalesce(old.data->>'state', '') <> 'ok' and new.author is not null then
      insert into public.notifications (to_id, text, sub, kind) values (new.author, '共有した「' || ttl || '」が公式の告知になりました', '', 'offer_ok');
    end if;
  end if;
  if new.kind = 'cal' and new.state = 'ok' and new.data->>'state' = 'pub' and (tg_op = 'INSERT' or coalesce(old.data->>'state', '') <> 'pub') then
    insert into public.notifications (to_id, text, sub, kind)
    select id, '新しいイベント：「' || ttl || '」', case when new.data->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then to_char((new.data->>'date')::date, 'FMMM月FMDD日') else '' end, 'evnew' from public.profiles where approved and id is distinct from auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists notif_items on public.items;
create trigger notif_items after insert or update on public.items for each row execute function public.notif_items();

-- 毎朝9時：期限の知らせ（担当本人に、本人が選んだ日数前）／期限が過ぎた翌日（担当とひとつ上のリーダー）
create or replace function public.due_job() returns int language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Tokyo')::date; r record; n int := 0; u uuid; top text;
begin
  for r in select x.* from public.nodes x
    where not x.done and coalesce(x.data->>'nodate', '') not in ('true', '1')
      and coalesce((x.data->>'folder')::boolean, false) = false
      and not exists (select 1 from public.nodes c where c.parent_id = x.id)
      and x.end_date between today - 1 and today + 30
  loop
    with recursive up as (select id, parent_id, title from public.nodes where id = r.id union all select p.id, p.parent_id, p.title from public.nodes p join up on p.id = up.parent_id)
    select title into top from up where parent_id is null limit 1;
    for u in select distinct v from unnest(array_append(r.team, r.who)) v where v is not null loop
      if r.end_date >= today and (r.end_date - today) = any(coalesce((select notif_due from public.profiles where id = u), '{3,0}')) then
        insert into public.notifications (to_id, text, sub, kind) values (u, case when r.end_date = today then '「' || r.title || '」は今日が期限です' else '「' || r.title || '」の期限まであと' || (r.end_date - today) || '日です' end, coalesce(top, ''), 'due');
        n := n + 1;
      end if;
    end loop;
    if r.end_date = today - 1 then
      for u in select distinct v from (
          select unnest(array_append(r.team, r.who)) v
          union select p.who from public.nodes p where p.id = r.parent_id
          union select (jsonb_array_elements_text(coalesce(p.data->'leads', '[]'::jsonb)))::uuid from public.nodes p where p.id = r.parent_id) s where v is not null loop
        insert into public.notifications (to_id, text, sub, kind) values (u, '「' || r.title || '」の期限が過ぎました', coalesce(top, ''), 'late');
        n := n + 1;
      end loop;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.due_job() from public, anon, authenticated;

-- 毎日20時：明日のイベントに参加登録した人へ（通知として作るので、設定がそのまま効く。プッシュは通知のトリガーが送る）
create or replace function public.remind_job() returns int language plpgsql security definer set search_path = public as $$
declare t date := (now() at time zone 'Asia/Tokyo')::date + 1; n int := 0;
begin
  insert into public.notifications (to_id, text, sub, kind)
  select r.user_id, '明日：' || (c.data->>'title'), coalesce(nullif(concat_ws(' · ', nullif(c.data->>'time', ''), nullif(c.data->>'place', '')), ''), '参加登録しているイベントです'), 'remind'
  from public.items c join public.reactions r on r.item_id = c.id and r.kind = 'join'
  where c.kind = 'cal' and c.state = 'ok' and c.data->>'state' = 'pub' and c.data->>'date' = t::text;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.remind_job() from public, anon, authenticated;

select cron.unschedule('slope-remind') where exists (select 1 from cron.job where jobname = 'slope-remind');
select cron.schedule('slope-remind', '0 11 * * *', 'select public.remind_job()'); -- UTC 11時＝日本時間 20時
select cron.unschedule('slope-due') where exists (select 1 from cron.job where jobname = 'slope-due');
select cron.schedule('slope-due', '0 0 * * *', 'select public.due_job()');        -- UTC 0時＝日本時間 9時
