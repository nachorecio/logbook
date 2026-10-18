-- Pilot Logbook · base de datos en Supabase
-- Pégalo entero en Supabase → SQL Editor → New query → Run.

create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  kind       text        not null check (kind in ('f','s','c','a','p','g','x')),   -- f vuelo · s simulador · c caducidad · a aeropuerto propio · p programado · g página cerrada · x ajustes (firma)
  d          date,                                             -- fecha del vuelo/sesión
  data       jsonb       not null,                             -- todas las columnas del libro
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Si ya ejecutaste una versión anterior de este script, esto amplía los tipos permitidos
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries add constraint entries_kind_check check (kind in ('f','s','c','a','p','g','x'));

create index if not exists entries_sync_idx on public.entries (user_id, updated_at, id);

-- La hora de cambio la pone siempre el servidor (sirve para sincronizar)
create or replace function public.entries_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries
for each row execute function public.entries_touch();

-- Cada usuario solo ve y toca sus propios registros
alter table public.entries enable row level security;

drop policy if exists "own rows select" on public.entries;
drop policy if exists "own rows insert" on public.entries;
drop policy if exists "own rows update" on public.entries;
drop policy if exists "own rows delete" on public.entries;
create policy "own rows select" on public.entries for select using (auth.uid() = user_id);
create policy "own rows insert" on public.entries for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.entries for delete using (auth.uid() = user_id);

-- Calendario suscrito de caducidades (logbook.pitulines.com/api/caducidades)
-- Devuelve solo las caducidades y la fecha de experiencia reciente del dueño del token secreto.
create or replace function public.ics_feed(t text)
returns table(kind text, id text, d date, data jsonb)
language sql security definer set search_path = public stable as $$
  select e.kind, e.id, e.d, e.data from public.entries e
  where length(t) >= 24
    and e.user_id = (select f.user_id from public.entries f
                     where f.kind = 'x' and f.id = 'feed' and not f.deleted and f.data->>'token' = t limit 1)
    and not e.deleted
    and (e.kind = 'c' or (e.kind = 'x' and e.id = 'feed'));
$$;
revoke all on function public.ics_feed(text) from public;
grant execute on function public.ics_feed(text) to anon, authenticated;
