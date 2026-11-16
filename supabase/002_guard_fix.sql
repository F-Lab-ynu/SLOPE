-- 管理者がSQLエディタ等（ログインユーザーなし）から直す場合は通す
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.post := old.post; new.approved := old.approved; new.roles := old.roles; new.email := old.email;
  end if;
  return new;
end $$;
