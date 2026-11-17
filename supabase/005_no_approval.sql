-- 承認制を一旦外す：新規ユーザーは最初から承認済み（戻すときは approved を false にする行に戻す）
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first boolean;
begin
  select not exists (select 1 from profiles) into first;
  insert into profiles (id, name, email, post, approved)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          coalesce(new.email, ''),
          case when first then '代表' else '—' end,
          true);
  return new;
end $$;
alter table public.profiles alter column approved set default true;
update public.profiles set approved = true where not approved;
