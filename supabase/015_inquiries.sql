-- お問い合わせ・要望：送った本人と、掲示板（部員の声）の権限を持つ運営だけが読める
create table if not exists public.inquiries (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default '要望',
  body text not null,
  status text not null default 'open',   -- open / done
  reply text not null default '',
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
drop policy if exists iq_sel on public.inquiries;
drop policy if exists iq_ins on public.inquiries;
drop policy if exists iq_upd on public.inquiries;
drop policy if exists iq_del on public.inquiries;
create policy iq_sel on public.inquiries for select using (user_id = auth.uid() or has_perm('board'));
create policy iq_ins on public.inquiries for insert with check (is_approved() and user_id = auth.uid() and status = 'open' and reply = '');
create policy iq_upd on public.inquiries for update using (has_perm('board')) with check (has_perm('board'));
create policy iq_del on public.inquiries for delete using (has_perm('board'));
