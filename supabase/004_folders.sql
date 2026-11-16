-- 業務をフォルダー／ファイル型に：追加の項目は data(jsonb) に入れる
--   data: { leads:[uuid], memo, folder:bool, purpose, place, review, links:[url] }
alter table public.nodes add column if not exists data jsonb not null default '{}'::jsonb;

-- 「そのノードのリーダー（担当）か」だけを見る（上の段は見ない）
create or replace function public.can_edit(node text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approved() and exists (
    select 1 from nodes where id = node
      and (who = auth.uid() or coalesce(data->'leads', '[]'::jsonb) ? auth.uid()::text)
  );
$$;

-- 作る・消す・動かす：一段上のリーダーだけ（一番上の段は代表）
drop policy if exists n_ins on public.nodes;
create policy n_ins on public.nodes for insert with check (
  (parent_id is null and public.is_admin()) or (parent_id is not null and public.can_edit(parent_id)));
drop policy if exists n_upd on public.nodes;
create policy n_upd on public.nodes for update
  using ((parent_id is null and public.is_admin()) or (parent_id is not null and public.can_edit(parent_id)) or who = auth.uid() or public.can_edit(id))
  with check ((parent_id is null and public.is_admin()) or (parent_id is not null and public.can_edit(parent_id)) or who = auth.uid() or public.can_edit(id));
drop policy if exists n_del on public.nodes;
create policy n_del on public.nodes for delete using (
  (parent_id is null and public.is_admin()) or (parent_id is not null and public.can_edit(parent_id)));
