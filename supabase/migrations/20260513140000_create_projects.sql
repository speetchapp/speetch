-- ============================================================================
-- Speetch — Table projects + refactor client_spaces
-- ----------------------------------------------------------------------------
-- Un client (profile) peut désormais avoir 1+ projets. Le contenu portfolio
-- (subtitle, content, project_type, is_published) migre de `profiles` vers
-- `projects`. Backfill : un projet créé par client existant à partir de ses
-- anciennes colonnes.
--
-- Les colonnes legacy sur `profiles` (subtitle, content, project_type,
-- is_published [côté client], delivery_date) ne sont PAS supprimées dans
-- cette migration — cleanup plus tard si tout fonctionne.
-- ============================================================================

-- 1. Table projects
create table if not exists public.projects (
  id              uuid        primary key default gen_random_uuid(),
  profile_id      uuid        not null references public.profiles(id) on delete cascade,
  name            text        not null,
  subtitle        text,
  project_type    text,
  content         jsonb       not null default '{}'::jsonb,
  is_published    boolean     not null default false,
  delivery_date   date,
  position        int         not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_profile_id_idx
  on public.projects(profile_id);
create index if not exists projects_published_position_idx
  on public.projects(profile_id, is_published, position);

-- Trigger updated_at (réutilise la fonction existante de la 1ère migration)
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- 2. RLS : admin-only via service-role (cohérent avec profiles)
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;

-- 3. Backfill : un projet créé par client existant
insert into public.projects
  (profile_id, name, subtitle, project_type, content, is_published, created_at)
select
  id, coalesce(full_name, 'Projet'), subtitle, project_type,
  content, is_published, created_at
from public.profiles
where is_owner = false
  and not exists (
    select 1 from public.projects p where p.profile_id = profiles.id
  );

-- 4. Nouvelle vue client_spaces : agrège les projets publiés en jsonb array.
--    security_invoker = false pour bypass le revoke d'anon sur profiles.
drop view if exists public.client_spaces;
create view public.client_spaces with (security_invoker = false) as
select
  p.id,
  p.slug,
  p.full_name,
  p.avatar_url,
  p.created_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',            pr.id,
          'name',          pr.name,
          'subtitle',      pr.subtitle,
          'project_type',  pr.project_type,
          'content',       pr.content,
          'delivery_date', pr.delivery_date,
          'created_at',    pr.created_at
        )
        order by pr.position asc, pr.created_at asc
      )
      from public.projects pr
      where pr.profile_id = p.id
        and pr.is_published = true
    ),
    '[]'::jsonb
  ) as projects
from public.profiles p
where p.is_owner = false
  and p.is_published = true
  and p.slug is not null;

grant select on public.client_spaces to anon, authenticated;
