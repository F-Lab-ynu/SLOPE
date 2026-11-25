-- 部員ホームの「お知らせ」（運営が出す。告知の権限）
alter table items drop constraint items_kind_check;
alter table items add constraint items_kind_check check (kind = any (array['recruit','idea','pain','other','comment','offer','notice','track','patch','cal','program','ann']));
create or replace function public.kind_perm(k text) returns text language sql immutable as $$
  select case when k in ('recruit', 'idea', 'pain', 'other', 'comment') then 'board'
              when k in ('offer', 'notice', 'cal', 'ann') then 'notices'
              when k in ('track', 'program') then 'tracks'
              when k = 'patch' then 'admin' else 'none' end;
$$;
drop policy if exists i_sel on items;
create policy i_sel on items for select using (is_approved() and ((author = auth.uid()) or has_perm(kind_perm(kind))
  or ((kind = any (array['recruit','idea','pain','other','comment','offer'])) and (state = 'ok'))
  or ((kind = any (array['notice','cal'])) and (state = 'ok') and ((data ->> 'state') = 'pub'))
  or ((kind = 'track') and (state = 'ok') and ((data ->> 'status') = 'pub'))
  or ((kind = any (array['patch','program','ann'])) and (state = 'ok'))));
