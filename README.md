# SLOPE（本番）

横浜国立大学 起業部の運営画面。GitHub Pages で公開し、データは Supabase に保存する。

- 公開URL: https://f-lab-ynu.github.io/SLOPE/
- モック（見た目の検討用）: https://github.com/F-Lab-ynu/SLOPE-mock

## 構成
- `index.html` … 部員アプリ（ホーム・学ぶ・掲示板・予定・マイページ）
- `admin.html` … 運営画面（業務・教材・外部告知・掲示板・メンバー）
- `supabase/` … データベースの作成SQL（テーブル・権限ルール）

## 権限の考え方
- ログインは Google。最初にログインした人が「代表」として承認済みになる。2人目以降は代表がメンバー画面で承認する。
- 業務は「その業務か上の段の担当（リーダー）」なら編集できる。個人の担当者は自分の業務の完了だけできる。
- 役職と承認は代表だけが変更できる。

## 修正のしかた（開発者向け）
`index.html` と `admin.html` は直接編集せず、`src/` から組み立てる。

- 画面の元：`src/mock/member-mock.html`（部員アプリ）、`src/mock/admin-mock.html`（運営画面）
- 本番用の追加コード：`src/member.js` `src/member_data.js`（部員）、`src/prod.js` `src/prod.css`（運営）
- 組み立て：リポジトリ直下で `python3 src/memberbuild.py` と `python3 src/build.py`
- 動作確認：`python3 src/test/t_member.py`、`python3 src/test/t_prod.py`（Supabase の代わりに偽物を使うので本番データには触れない）
- データベースの変更：`supabase/` に番号付きの SQL を足していく
