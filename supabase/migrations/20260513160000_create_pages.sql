-- ============================================================================
-- Speetch — Table pages
-- ----------------------------------------------------------------------------
-- Un projet peut désormais contenir 1+ pages, chacune créée à partir d'un
-- template (preset défini dans lib/page-templates.ts).
--
-- Le contenu de la page est stocké dans `content` (jsonb), pré-rempli au
-- moment de la création par le `defaultContent` du template (sections avec
-- uuids frais générés côté Server Action).
--
-- Pas de FK vers les templates : `template_id` est une chaîne libre validée
-- côté app via isValidTemplateId() (même approche que project_type).
-- ============================================================================

-- 1. Table
create table if not exists public.pages (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references public.projects(id) on delete cascade,
  name          text        not null,
  slug          text        not null,
  template_id   text        not null,
  content       jsonb       not null default '{}'::jsonb,
  position      int         not null default 0,
  is_published  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Slug unique au sein d'un projet (pour le futur URL /clients/x/y/z)
create unique index if not exists pages_project_slug_unique_idx
  on public.pages (project_id, slug);

create index if not exists pages_project_position_idx
  on public.pages (project_id, position);

-- Trigger updated_at (réutilise la fonction existante touch_updated_at())
drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
  before update on public.pages
  for each row execute function public.touch_updated_at();

-- 2. RLS : admin-only via service-role (cohérent avec profiles/projects)
alter table public.pages enable row level security;
revoke all on public.pages from anon, authenticated;
