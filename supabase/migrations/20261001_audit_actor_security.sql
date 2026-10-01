-- Run this migration once in Supabase SQL Editor.
-- Do not rerun supabase/schema.sql on an existing database.

drop policy if exists "admins manage profiles" on public.admin_profiles;
drop policy if exists "admins read profiles" on public.admin_profiles;
drop policy if exists "admins manage own profile" on public.admin_profiles;
drop policy if exists "admins update own profile" on public.admin_profiles;

create policy "admins read profiles"
on public.admin_profiles for select to authenticated
using (true);

create policy "admins manage own profile"
on public.admin_profiles for insert to authenticated
with check (user_id = auth.uid());

create policy "admins update own profile"
on public.admin_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "admins manage audit log" on public.audit_log;
drop policy if exists "admins read audit log" on public.audit_log;
drop policy if exists "admins create own audit log" on public.audit_log;

create policy "admins read audit log"
on public.audit_log for select to authenticated
using (true);

create policy "admins create own audit log"
on public.audit_log for insert to authenticated
with check (actor_user_id = auth.uid());

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
