-- 業務の権限：自分がリーダー・担当（メンバー）になっているノードと、その下はすべて編集できる。代表はすべて
create or replace function public.can_edit(node text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approved() and (public.is_admin() or exists (
    with recursive up as (
      select id, parent_id, who, team, data from nodes where id = node
      union all
      select n.id, n.parent_id, n.who, n.team, n.data from nodes n join up on n.id = up.parent_id
    )
    select 1 from up where who = auth.uid() or auth.uid() = any(team) or coalesce(data->'leads', '[]'::jsonb) ? auth.uid()::text
  ));
$$;
drop policy if exists n_ins on public.nodes;
create policy n_ins on public.nodes for insert with check (
  public.is_admin() or (parent_id is not null and public.can_edit(parent_id)));
drop policy if exists n_upd on public.nodes;
create policy n_upd on public.nodes for update
  using (public.is_admin() or public.can_edit(id))
  with check (public.is_admin() or public.can_edit(id) or (parent_id is not null and public.can_edit(parent_id)));
drop policy if exists n_del on public.nodes;
create policy n_del on public.nodes for delete using (public.is_admin() or public.can_edit(id));
