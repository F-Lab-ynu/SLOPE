-- 更新履歴（今後の更新・パッチノート）：全員が見られて、書けるのは代表だけ
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer', 'notice', 'track', 'patch'));
create or replace function public.kind_perm(k text) returns text
language sql immutable as $$
  select case when k in ('recruit', 'idea', 'pain', 'other', 'comment') then 'board'
              when k in ('offer', 'notice') then 'notices'
              when k = 'track' then 'tracks'
              when k = 'patch' then 'admin' else 'none' end;
$$;
drop policy if exists i_sel on public.items;
create policy i_sel on public.items for select using (
  public.is_approved() and (
    author = auth.uid()
    or public.has_perm(public.kind_perm(kind))
    or (kind in ('recruit', 'idea', 'pain', 'other', 'comment', 'offer') and state = 'ok')
    or (kind = 'notice' and state = 'ok' and data->>'state' = 'pub')
    or (kind = 'track' and state = 'ok' and data->>'status' = 'pub')
    or (kind = 'patch' and state = 'ok')
  ));

insert into public.items (id, kind, author, data, pos) values
('pt0','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-16", "title": "運営画面を公開", "note": "Googleログイン・承認制・リアルタイム同期", "state": "done"}'::jsonb,0),
('pt1','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-16", "title": "プライバシーポリシーを追加", "note": "", "state": "done"}'::jsonb,1),
('pt2','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-16", "title": "部員アプリを公開", "note": "運営画面の教材・外部告知・掲示板もデータベースに接続", "state": "done"}'::jsonb,2),
('pt3','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-17", "title": "業務をフォルダー/ファイル型に刷新", "note": "リーダー複数・メモ・カード/ガントチャート切替・右クリック・教材の新レイアウト・ダッシュボード3区分", "state": "done"}'::jsonb,3),
('pt4','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-17", "title": "承認制を一旦停止", "note": "新しく入った人は最初から使える", "state": "done"}'::jsonb,4),
('pt5','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-17", "title": "告知を＋ボタンとポップアップで作成", "note": "対象ロール・詳細も入力可。各行に編集ボタン", "state": "done"}'::jsonb,5),
('pt6','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-17", "title": "スマホ表示の修正", "note": "＋ボタンとタブバーの重なり、画面全体がスクロールする不具合、ログインを2回押す必要がある不具合", "state": "done"}'::jsonb,6),
('pt7','patch',(select id from public.profiles where post='代表' order by created_at limit 1),'{"date": "2026-11-17", "title": "ダッシュボードに更新履歴を追加", "note": "今後の更新とパッチノートを記録できる（編集は代表のみ）", "state": "done"}'::jsonb,7)
on conflict (id) do nothing;
