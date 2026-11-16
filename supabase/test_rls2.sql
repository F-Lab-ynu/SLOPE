do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  out text := ''; n int; st text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values (a, 'a@t.invalid', '{"full_name":"代表A"}', 'authenticated', 'authenticated');
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values (b, 'b@t.invalid', '{"full_name":"広報B"}', 'authenticated', 'authenticated'),
    (c, 'c@t.invalid', '{"full_name":"部員C"}', 'authenticated', 'authenticated'), (x, 'x@t.invalid', '{"full_name":"未承認X"}', 'authenticated', 'authenticated');
  update public.profiles set approved = true, post = '外務部 広報局' where id = b;
  update public.profiles set approved = true where id = c;
  insert into public.items (id, kind, author, data) values ('TD', 'track', a, '{"name":"下書き","status":"draft"}'), ('TP', 'track', a, '{"name":"公開","status":"pub"}'),
    ('ND', 'notice', a, '{"title":"下書き","state":"draft"}'), ('NP', 'notice', a, '{"title":"公開","state":"pub"}');

  -- 部員C
  set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.items where kind = 'track'; out := out || 'C:見えるトラック=' || n;
  select count(*) into n from public.items where kind = 'notice'; out := out || ' | C:見える告知=' || n;
  insert into public.items (id, kind, author, data) values ('R1', 'recruit', c, '{"title":"募集"}'); out := out || ' | C:募集を投稿=OK';
  begin insert into public.items (id, kind, author, data) values ('N9', 'notice', c, '{"state":"pub"}'); out := out || ' | C:告知を投稿=OK(×)'; exception when others then out := out || ' | C:告知を投稿=拒否'; end;
  begin insert into public.items (id, kind, author, data) values ('R2', 'recruit', a, '{}'); out := out || ' | C:他人名義=OK(×)'; exception when others then out := out || ' | C:他人名義=拒否'; end;
  update public.items set data = '{"name":"改ざん"}' where id = 'TP'; get diagnostics n = row_count; out := out || ' | C:トラック改ざん=' || n;
  insert into public.reactions (item_id, kind) values ('R1', 'emp'); out := out || ' | C:共感=OK';
  begin insert into public.reactions (item_id, user_id, kind) values ('R1', a, 'emp'); out := out || ' | C:他人の共感=OK(×)'; exception when others then out := out || ' | C:他人の共感=拒否'; end;
  insert into public.reports (item_id, reason) values ('R1', 'テスト'); out := out || ' | C:通報=OK';
  reset role;

  -- 広報B：非表示にする
  set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reports; out := out || ' | B:見える通報=' || n;
  update public.items set state = 'hidden' where id = 'R1'; get diagnostics n = row_count; out := out || ' | B:非表示=' || n;
  update public.items set data = '{}' where id = 'TP'; get diagnostics n = row_count; out := out || ' | B:トラック編集=' || n;
  reset role;

  -- 部員C：自分で戻せないこと
  set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  update public.items set state = 'ok' where id = 'R1';
  reset role;
  select state into st from public.items where id = 'R1'; out := out || ' | C:非表示を戻す→' || st;

  -- 未承認X
  set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from public.items; out := out || ' | X:見えるもの=' || n;
  begin insert into public.items (id, kind, author, data) values ('R3', 'recruit', x, '{}'); out := out || ' | X:投稿=OK(×)'; exception when others then out := out || ' | X:投稿=拒否'; end;
  reset role;
  raise exception 'RESULT %', out;
end $$;
