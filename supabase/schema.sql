-- Run this once in Supabase SQL Editor for the RIMSTACKLE project.
create extension if not exists pgcrypto;

create table if not exists public.weekly_drops (
  id text primary key,
  number text not null,
  status text not null default 'DRAFT' check (status in ('ACTIVE', 'DRAFT', 'EXPIRED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.brands (
  code text primary key,
  name text not null unique,
  logo text,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  code text primary key,
  city text not null,
  name text not null,
  stores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  name text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  code text primary key,
  drop_id text not null references public.weekly_drops(id) on update cascade,
  location_code text references public.locations(code),
  brand_code text references public.brands(code),
  brand text not null,
  model text not null,
  category text not null references public.categories(name),
  store text,
  subtitle text,
  description text,
  price numeric(12,2) not null check (price > 0),
  japan_price numeric(12,2),
  condition text not null,
  grade smallint check (grade between 1 and 10),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'EXPIRED')),
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists admin_profiles_display_name_unique on public.admin_profiles (lower(display_name));

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.weekly_drops enable row level security;
alter table public.brands enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.audit_log enable row level security;

create policy "public can read active weekly drops" on public.weekly_drops for select to anon, authenticated using (status = 'ACTIVE' and now() >= starts_at and now() < ends_at or auth.uid() is not null);
create policy "admins manage weekly drops" on public.weekly_drops for all to authenticated using (true) with check (true);
create policy "public can read products in active drops" on public.products for select to anon, authenticated using (exists (select 1 from public.weekly_drops d where d.id = drop_id and d.status = 'ACTIVE' and now() >= d.starts_at and now() < d.ends_at) or auth.uid() is not null);
create policy "admins manage products" on public.products for all to authenticated using (true) with check (true);
create policy "admins manage brands" on public.brands for all to authenticated using (true) with check (true);
create policy "admins manage locations" on public.locations for all to authenticated using (true) with check (true);
create policy "admins manage categories" on public.categories for all to authenticated using (true) with check (true);
drop policy if exists "admins manage profiles" on public.admin_profiles;
drop policy if exists "admins read profiles" on public.admin_profiles;
drop policy if exists "admins manage own profile" on public.admin_profiles;
drop policy if exists "admins update own profile" on public.admin_profiles;
create policy "admins read profiles" on public.admin_profiles for select to authenticated using (true);
create policy "admins manage own profile" on public.admin_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "admins update own profile" on public.admin_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admins manage audit log" on public.audit_log;
drop policy if exists "admins read audit log" on public.audit_log;
drop policy if exists "admins create own audit log" on public.audit_log;
create policy "admins read audit log" on public.audit_log for select to authenticated using (true);
create policy "admins create own audit log" on public.audit_log for insert to authenticated with check (actor_user_id = auth.uid());

create or replace function public.set_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_user_id := auth.uid();
  select display_name into new.actor_name
  from public.admin_profiles
  where user_id = auth.uid();
  new.actor_name := coalesce(nullif(trim(new.actor_name), ''), auth.jwt() ->> 'email', 'Admin');
  return new;
end;
$$;

drop trigger if exists audit_log_set_actor on public.audit_log;
create trigger audit_log_set_actor
before insert on public.audit_log
for each row execute function public.set_audit_actor();

insert into public.categories (name, label) values
  ('Reel', 'Reel'), ('Rod', 'Rod'), ('Lure', 'Lure'), ('Accessories', 'Accessories'), ('Spare part', 'Spare part'), ('Others', 'Others')
on conflict (name) do nothing;

insert into public.brands (code, name) values
  ('SHI', 'Shimano'), ('DAI', 'Daiwa'), ('MEG', 'Megabass'), ('ABU', 'Abu Garcia'), ('JAC', 'Jackall'), ('EVE', 'Evergreen'), ('OTH', 'Others')
on conflict (code) do nothing;
