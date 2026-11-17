-- プログラム（部員の「プログラム」タブの並び）：items の kind 'program'（id 'program' の1行）。教材の権限で編集、全員が読める
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer', 'notice', 'track', 'patch', 'cal', 'program'));
create or replace function public.kind_perm(k text) returns text
language sql immutable as $$
  select case when k in ('recruit', 'idea', 'pain', 'other', 'comment') then 'board'
              when k in ('offer', 'notice', 'cal') then 'notices'
              when k in ('track', 'program') then 'tracks'
              when k = 'patch' then 'admin' else 'none' end;
$$;
drop policy if exists i_sel on public.items;
create policy i_sel on public.items for select using (
  public.is_approved() and (
    author = auth.uid()
    or public.has_perm(public.kind_perm(kind))
    or (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer') and state = 'ok')
    or (kind in ('notice', 'cal') and state = 'ok' and data->>'state' = 'pub')
    or (kind = 'track' and state = 'ok' and data->>'status' = 'pub')
    or (kind in ('patch', 'program') and state = 'ok')
  ));
