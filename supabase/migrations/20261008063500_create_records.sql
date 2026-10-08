-- One row per synced object (track or set), stored as JSON.
create table public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('track', 'set')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  -- when the client last changed it (used for last-write-wins)
  client_updated_at timestamptz not null,
  -- set by the server on every write (used as the pull cursor)
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

create policy "Owner can read" on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner can insert" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner can update" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner can delete" on public.records for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.records from anon;

-- Server timestamp on every write, and never let an older client version overwrite a newer one.
create function public.records_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return null; -- keep the newer row
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger records_before_write
before insert or update on public.records
for each row execute function public.records_before_write();
