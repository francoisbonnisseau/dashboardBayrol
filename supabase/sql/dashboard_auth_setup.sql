-- Dashboard custom auth schema (without Supabase Auth)
-- Run this once in Supabase SQL Editor.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dashboard_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.dashboard_users(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_users_username_idx
  on public.dashboard_users (username);

create index if not exists dashboard_sessions_hash_idx
  on public.dashboard_sessions (session_hash);

create index if not exists dashboard_sessions_user_id_idx
  on public.dashboard_sessions (user_id);

create index if not exists dashboard_sessions_expires_at_idx
  on public.dashboard_sessions (expires_at);

alter table public.dashboard_users enable row level security;
alter table public.dashboard_sessions enable row level security;

create or replace function public.dashboard_verify_user(p_username text, p_password text)
returns table (id uuid, role text)
language sql
security definer
set search_path = public
as $$
  with candidate as (
    select
      u.id,
      u.role,
      case
        when u.password_hash like '$2b$%' then regexp_replace(u.password_hash, '^\$2b\$', '$2a$')
        when u.password_hash like '$2y$%' then regexp_replace(u.password_hash, '^\$2y\$', '$2a$')
        else u.password_hash
      end as normalized_hash
    from public.dashboard_users u
    where lower(trim(u.username)) = lower(trim(p_username))
      and u.is_active = true
  )
  select c.id, c.role
  from candidate c
  where c.normalized_hash = extensions.crypt(p_password, c.normalized_hash)
  limit 1;
$$;

-- Optional bootstrap user (change username/password immediately)
-- Password hash uses bcrypt via pgcrypto crypt().
insert into public.dashboard_users (username, password_hash, role)
values (
  'admin',
  extensions.crypt('change_this_password_now', extensions.gen_salt('bf', 12)),
  'admin'
)
on conflict (username) do nothing;

-- Helper query to rotate password for a user:
-- update public.dashboard_users
-- set password_hash = extensions.crypt('new_password_here', extensions.gen_salt('bf', 12))
-- where username = 'admin';
