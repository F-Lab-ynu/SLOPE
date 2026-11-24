-- カレンダーの購読用URL：部員ごとの合い言葉（トークン）。本人だけが読める
create table if not exists public.cal_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.cal_tokens enable row level security;
drop policy if exists ct_sel on public.cal_tokens;
drop policy if exists ct_ins on public.cal_tokens;
drop policy if exists ct_del on public.cal_tokens;
create policy ct_sel on public.cal_tokens for select using (user_id = auth.uid());
create policy ct_ins on public.cal_tokens for insert with check (user_id = auth.uid());
create policy ct_del on public.cal_tokens for delete using (user_id = auth.uid());
