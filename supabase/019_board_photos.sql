-- 掲示板の写真（部員だけが見られる。自分の写真だけ上げ・消し）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board', 'board', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists board_sel on storage.objects;
drop policy if exists board_ins on storage.objects;
drop policy if exists board_del on storage.objects;
create policy board_sel on storage.objects for select to authenticated using (bucket_id = 'board' and public.is_approved());
create policy board_ins on storage.objects for insert to authenticated with check (bucket_id = 'board' and public.is_approved() and (storage.foldername(name))[1] = auth.uid()::text);
create policy board_del on storage.objects for delete to authenticated using (bucket_id = 'board' and (owner = auth.uid() or public.has_perm('board')));
