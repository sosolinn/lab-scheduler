-- Local username/password authentication tables.
-- Run with the Supabase SQL Editor if you prefer an explicit migration.
-- The Next.js server also creates these tables automatically on first use.

create table if not exists public.lab_users (
  id uuid primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'user'
    check (role in ('admin', 'user')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_sessions (
  token_hash text primary key,
  user_id uuid not null references public.lab_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists lab_sessions_user_idx
  on public.lab_sessions (user_id);

create index if not exists lab_sessions_expiry_idx
  on public.lab_sessions (expires_at);

alter table public.lab_users enable row level security;
alter table public.lab_sessions enable row level security;

revoke all on table public.lab_users from anon, authenticated;
revoke all on table public.lab_sessions from anon, authenticated;
