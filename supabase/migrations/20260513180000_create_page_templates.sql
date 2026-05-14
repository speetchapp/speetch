-- ============================================================================
-- Speetch — Table page_templates
-- ----------------------------------------------------------------------------
-- Templates personnalisés stockés en BDD (en complément des presets code dans
-- lib/page-templates.ts). Créés par l'admin depuis l'upload d'une page HTML
-- transformée via l'API Claude en PageContent JSON.
--
-- Filtrage : `project_type` (nullable) — quand non-null, le template n'apparaît
-- que pour les projets de ce type ; sinon, visible partout. Cohérent avec la
-- liste libre dans lib/project-types.ts (pas de FK).
--
-- `source_html` est conservé pour traçabilité et reconversion future.
-- ============================================================================

create table if not exists public.page_templates (
  id              uuid        primary key default gen_random_uuid(),
  label           text        not null,
  tagline         text,
  description     text,
  project_type    text,
  default_content jsonb       not null default '{}'::jsonb,
  source_html     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists page_templates_project_type_idx
  on public.page_templates (project_type);

-- Trigger updated_at (réutilise la fonction touch_updated_at())
drop trigger if exists page_templates_touch_updated_at on public.page_templates;
create trigger page_templates_touch_updated_at
  before update on public.page_templates
  for each row execute function public.touch_updated_at();

-- RLS : admin-only via service-role
alter table public.page_templates enable row level security;
revoke all on public.page_templates from anon, authenticated;
