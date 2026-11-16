-- フォルダー型の権限確認（最後に必ずエラーで終わる＝何も残らない）
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); out text := ''; n int;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'ta@test.invalid', '{"full_name":"代表A"}', 'authenticated', 'authenticated'),
    (b, 'tb@test.invalid', '{"full_name":"リーダーB"}', 'authenticated', 'authenticated'),
    (c, 'tc@test.invalid', '{"full_name":"担当C"}', 'authenticated', 'authenticated');
  update public.profiles set approved = true where id in (a, b, c);
  update public.profiles set post = '代表' where id = a;
  insert into public.nodes (id, parent_id, title, who, data) values
    ('tR', null, '2026起業部', a, json_build_object('leads', json_build_array(a))::jsonb),
    ('tF', 'tR', 'MIRA', null, json_build_object('leads', json_build_array(b), 'folder', true)::jsonb),
    ('tL', 'tF', '会場予約', c, '{}'::jsonb),
    ('tX', null, '別の年度', null, '{}'::jsonb);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.nodes set title = 'MIRA改' where id = 'tF'; get diagnostics n = row_count; out := out || 'A:子フォルダー編集=' || n;
  update public.nodes set title = 'x' where id = 'tL'; get diagnostics n = row_count; out := out || ' | A:孫を編集=' || n;
  delete from public.nodes where id = 'tL'; get diagnostics n = row_count; out := out || ' | A:孫を削除=' || n;
  begin insert into public.nodes (id, parent_id, title) values ('tN0', null, '新年度'); out := out || ' | A:一番上に追加=OK'; exception when others then out := out || ' | A:一番上に追加=NG'; end;
  begin insert into public.nodes (id, parent_id, title) values ('tN1', 'tF', 'x'); out := out || ' | A:孫に追加=OK(×)'; exception when others then out := out || ' | A:孫に追加=拒否'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.nodes set title = '会場予約改' where id = 'tL'; get diagnostics n = row_count; out := out || ' | B:中のファイル編集=' || n;
  begin insert into public.nodes (id, parent_id, title) values ('tN2', 'tF', '新しいファイル'); out := out || ' | B:中に追加=OK'; exception when others then out := out || ' | B:中に追加=NG'; end;
  update public.nodes set title = 'x' where id = 'tR'; get diagnostics n = row_count; out := out || ' | B:上を編集=' || n;
  begin insert into public.nodes (id, parent_id, title) values ('tN3', null, 'x'); out := out || ' | B:一番上に追加=OK(×)'; exception when others then out := out || ' | B:一番上に追加=拒否'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  update public.nodes set done = true, data = '{"memo":"A会館で予約"}' where id = 'tL'; get diagnostics n = row_count; out := out || ' | C:自分のファイルを完了・メモ=' || n;
  update public.nodes set title = 'x' where id = 'tF'; get diagnostics n = row_count; out := out || ' | C:上のフォルダー編集=' || n;
  reset role;
  raise exception 'RESULT %', out;
end $$;
