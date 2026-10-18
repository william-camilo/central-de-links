-- Organização única da biblioteca pessoal, acessível somente após validar o PIN.
create table public.library_organization (
  id boolean primary key default true check (id),
  data jsonb not null default '{"version":1,"folders":[],"links":{}}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint organization_object check (jsonb_typeof(data) = 'object'),
  constraint organization_size check (octet_length(data::text) <= 4194304)
);
alter table public.library_organization enable row level security;
revoke all on public.library_organization from public, anon, authenticated;
grant select, update on public.library_organization to service_role;
insert into public.library_organization (id) values (true);
comment on table public.library_organization is 'Pastas, favoritos e tags privados; sem políticas públicas. Acesso via manage-admin após autenticação por PIN.';
