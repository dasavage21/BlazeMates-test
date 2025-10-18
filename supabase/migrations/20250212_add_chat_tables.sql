create extension if not exists "pgcrypto";

create table if not exists public.threads (
  id text primary key,
  created_at timestamptz default now(),
  typing jsonb default '{}'::jsonb
);

alter table public.threads enable row level security;

drop policy if exists "threads_auth_all" on public.threads;

create policy "threads_auth_select"
  on public.threads
  for select
  using (auth.role() = 'authenticated');

create policy "threads_auth_insert"
  on public.threads
  for insert
  with check (auth.role() = 'authenticated');

create policy "threads_auth_update"
  on public.threads
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "messages_auth_select" on public.messages;
drop policy if exists "messages_auth_insert" on public.messages;

create policy "messages_auth_select"
  on public.messages
  for select
  using (auth.role() = 'authenticated');

create policy "messages_auth_insert"
  on public.messages
  for insert
  with check (auth.uid() = sender_id);

create table if not exists public.read_receipts (
  thread_id text not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (thread_id, user_id)
);

alter table public.read_receipts enable row level security;

drop policy if exists "read_receipts_auth_select" on public.read_receipts;
drop policy if exists "read_receipts_auth_insert" on public.read_receipts;
drop policy if exists "read_receipts_auth_update" on public.read_receipts;

create policy "read_receipts_auth_select"
  on public.read_receipts
  for select
  using (auth.role() = 'authenticated');

create policy "read_receipts_auth_insert"
  on public.read_receipts
  for insert
  with check (auth.uid() = user_id);

create policy "read_receipts_auth_update"
  on public.read_receipts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
