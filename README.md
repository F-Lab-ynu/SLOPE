# SLOPE（本番）

横浜国立大学 起業部の部員アプリと運営画面。GitHub Pages で公開し、データは Supabase に保存する。

- 公開URL: https://f-lab-ynu.github.io/SLOPE/

## 構成
- `index.html` … 部員アプリ（ホーム・学ぶ・ニュース・掲示板・予定・マイページ）
- `admin.html` … 運営画面（ダッシュボード・業務・教材・告知・サポート・メンバー）
- `sw.js` … オフライン表示とプッシュ通知
- `supabase/` … データベースの変更SQL（番号順に適用）、`functions/`（カレンダー購読・プッシュ通知）、`tests/`（権限ルールの確認）
- `.github/workflows/keepalive.yml` … Supabase が休止しないよう毎日アクセス

## 権限の考え方
- ログインは Google のみ。最初にログインした人が「代表」になる（承認制は停止中）。
- 業務は「その業務か上の段の担当（リーダー）」なら編集できる。個人の担当者は自分の業務の完了だけできる。
- 役職と承認は代表だけが変更できる。

## 修正のしかた（開発者向け）
`index.html` と `admin.html` は直接編集せず、`src/` から組み立てる。

- 運営画面の元：`src/admin/`
  - `page.html` … 画面の骨組み（`/*@@CSS@@*/` と `//@@JS@@` に下の2つが入る）
  - `admin.css` … 見た目
  - `js/*.js` … 動き。番号順につなげて1つのスクリプトになる（イベントの受け取り順に意味があるので番号は保つ）
- 部員アプリの元：`src/mock/member-mock.html`
- 本番用の追加コード：`src/member.js` `src/member_data.js`（部員）、`src/prod.js` `src/prod.css`（運営）
- 色：`src/theme.py` が部員アプリの色をテーマ用の変数に置きかえる（組み立て時に自動）
- 組み立て：リポジトリ直下で `python3 src/memberbuild.py` と `python3 src/build.py`
- 動作確認：`src/test/` の各テスト（`python3 src/test/t_admin.py` など。Supabase の代わりに偽物を使うので本番データには触れない）
- 見た目が変わっていないかの確認：`python3 src/test/snap_admin.py /tmp/a` → 直す → `python3 src/test/snap_admin.py /tmp/b` → `diff -rq /tmp/a /tmp/b`（運営画面をサンプルデータで決まった順に触り、各段階の画面を保存する）
- データベースの変更：`supabase/` に番号付きの SQL を足していく
