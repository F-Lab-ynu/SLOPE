-- 権限ルールの確認。最後に必ずエラーで終わるので、変更はすべて取り消される（何も残らない）
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  out text := ''; n int; ok boolean;
  procedure_dummy int;
begin
  if exists (select 1 from public.profiles) then raise exception 'ABORT: profiles not empty'; end if;
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'a@test.invalid', '{"full_name":"代表A"}', 'authenticated', 'authenticated');
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (b, 'b@test.invalid', '{"full_name":"部長B"}', 'authenticated', 'authenticated'),
    (c, 'c@test.invalid', '{"full_name":"部員C"}', 'authenticated', 'authenticated'),
    (x, 'x@test.invalid', '{"full_name":"未承認X"}', 'authenticated', 'authenticated');
  select string_agg(name || ':' || post || ':' || approved, ', ' order by created_at) into out from public.profiles;
  out := 'profiles=' || out;
  update public.profiles set approved = true, post = '教育部' where id = b;
  update public.profiles set approved = true where id = c;
  insert into public.nodes (id, parent_id, title, who) values ('E', null, 'イベント', a), ('D', 'E', '部', b), ('T', 'D', 'チーム', null), ('L', 'T', '個人', c), ('O', 'E', '別の部', null);

  -- 部長B として
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.nodes; out := out || ' | B見える=' || n;
  update public.nodes set title = 'チーム改' where id = 'T'; get diagnostics n = row_count; out := out || ' | B:配下を編集=' || n;
  update public.nodes set title = '別の部改' where id = 'O'; get diagnostics n = row_count; out := out || ' | B:担当外を編集=' || n;
  begin insert into public.nodes (id, parent_id, title) values ('N1', 'T', '新規'); out := out || ' | B:配下に追加=OK'; exception when others then out := out || ' | B:配下に追加=NG'; end;
  begin insert into public.nodes (id, parent_id, title) values ('N2', 'O', '新規'); out := out || ' | B:担当外に追加=OK(×)'; exception when others then out := out || ' | B:担当外に追加=拒否'; end;
  begin insert into public.nodes (id, parent_id, title) values ('N3', null, 'イベント'); out := out || ' | B:イベント追加=OK(×)'; exception when others then out := out || ' | B:イベント追加=拒否'; end;
  update public.profiles set post = '代表' where id = b;
  reset role;
  select post into out from (select out || ' | B:自分を代表に→' || post as post from public.profiles where id = b) s;

  -- 部員C（個人の担当）として
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  update public.nodes set done = true where id = 'L'; get diagnostics n = row_count; out := out || ' | C:自分の業務を完了=' || n;
  update public.nodes set title = 'x' where id = 'T'; get diagnostics n = row_count; out := out || ' | C:上の段を編集=' || n;
  delete from public.nodes where id = 'D'; get diagnostics n = row_count; out := out || ' | C:部を削除=' || n;
  begin insert into public.notifications (to_id, text) values (b, '完了しました'); out := out || ' | C:通知を送る=OK'; exception when others then out := out || ' | C:通知を送る=NG'; end;
  select count(*) into n from public.notifications; out := out || ' | C:他人宛て通知が見える=' || n;
  reset role;

  -- 未承認X として
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from public.nodes; out := out || ' | X見える業務=' || n;
  select count(*) into n from public.profiles; out := out || ' | X見えるプロフィール=' || n;
  update public.profiles set approved = true where id = x; reset role;
  select approved into ok from public.profiles where id = x; out := out || ' | X:自分を承認→' || ok;

  -- 代表A として
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.profiles set approved = true where id = x; get diagnostics n = row_count; out := out || ' | A:Xを承認=' || n;
  delete from public.nodes where id = 'O'; get diagnostics n = row_count; out := out || ' | A:削除=' || n;
  reset role;
  raise exception 'RESULT %', out;
end $$;
