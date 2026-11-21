-- PDFify accounts: run this ONCE in Supabase > SQL Editor > New query > Run
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'My project',
  public_key text not null unique,
  secret_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon;
grant select, insert, delete on public.api_keys to authenticated;

drop policy if exists "keys read own" on public.api_keys;
drop policy if exists "keys create own" on public.api_keys;
drop policy if exists "keys delete own" on public.api_keys;
create policy "keys read own" on public.api_keys for select to authenticated using (auth.uid() = user_id);
create policy "keys create own" on public.api_keys for insert to authenticated with check (auth.uid() = user_id);
create policy "keys delete own" on public.api_keys for delete to authenticated using (auth.uid() = user_id);

-- at most 5 keys per account
create or replace function public.limit_api_keys() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.api_keys where user_id = new.user_id) >= 5 then
    raise exception 'You can have up to 5 keys';
  end if;
  return new;
end;
$$;
drop trigger if exists api_keys_limit on public.api_keys;
create trigger api_keys_limit before insert on public.api_keys for each row execute function public.limit_api_keys();
