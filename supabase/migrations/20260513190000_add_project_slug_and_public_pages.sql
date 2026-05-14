-- ============================================================================
-- Speetch — projects.slug + vues publiques pages
-- ----------------------------------------------------------------------------
-- 1. Ajoute projects.slug + index unique (profile_id, slug) + backfill depuis
--    name (avec déduplication par suffixe -2, -3, …).
-- 2. Recrée la vue client_spaces : on retire `content` (legacy, plus rendu) et
--    on nest `pages` (id, name, slug, position, created_at) — uniquement les
--    pages publiées. Ajoute `slug` au niveau du projet.
-- 3. Crée la vue client_pages pour lookup d'une page publique par
--    (client_slug, project_slug, page_slug). Filtre sur is_published côté
--    profil + projet + page.
-- ============================================================================

-- 1.a. Colonne slug (nullable d'abord, on backfill ensuite)
alter table public.projects
  add column if not exists slug text;

-- 1.b. Backfill : slug = lower(regexp_replace(name, '[^a-z0-9]+', '-')) avec
--      collisions résolues par suffixe numérique au sein d'un même profile_id.
do $$
declare
  rec record;
  base_slug text;
  candidate text;
  n int;
begin
  for rec in
    select id, profile_id, name
      from public.projects
     where slug is null
     order by created_at asc
  loop
    base_slug := regexp_replace(
                   regexp_replace(lower(rec.name), '[^a-z0-9]+', '-', 'g'),
                   '(^-+|-+$)', '', 'g'
                 );
    if base_slug = '' then
      base_slug := 'projet';
    end if;
    base_slug := substring(base_slug from 1 for 80);

    candidate := base_slug;
    n := 2;
    while exists (
      select 1 from public.projects
       where profile_id = rec.profile_id
         and slug = candidate
         and id <> rec.id
    ) loop
      candidate := base_slug || '-' || n;
      n := n + 1;
      if n > 999 then
        raise exception 'Cannot generate unique slug for project %', rec.id;
      end if;
    end loop;

    update public.projects set slug = candidate where id = rec.id;
  end loop;
end $$;

-- 1.c. Contraintes
alter table public.projects
  alter column slug set not null;

create unique index if not exists projects_profile_slug_unique_idx
  on public.projects (profile_id, slug);

-- 2. Vue client_spaces : on remplace l'agrégat projects.content par une liste
--    de pages publiées par projet. Le frontend public lira ces liens, plus
--    de rendu de projects.content.
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
          'slug',          pr.slug,
          'subtitle',      pr.subtitle,
          'project_type',  pr.project_type,
          'delivery_date', pr.delivery_date,
          'created_at',    pr.created_at,
          'pages',         coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id',         pa.id,
                  'name',       pa.name,
                  'slug',       pa.slug,
                  'position',   pa.position,
                  'created_at', pa.created_at
                )
                order by pa.position asc, pa.created_at asc
              )
              from public.pages pa
              where pa.project_id = pr.id
                and pa.is_published = true
            ),
            '[]'::jsonb
          )
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

-- 3. Vue client_pages : un lookup par (client_slug, project_slug, page_slug)
--    pour le rendu de /clients/[slug]/[projectSlug]/[pageSlug]. On retourne
--    aussi le contexte (nom client, nom projet) pour le breadcrumb.
drop view if exists public.client_pages;
create view public.client_pages with (security_invoker = false) as
select
  p.id           as profile_id,
  p.slug         as client_slug,
  p.full_name    as client_name,
  pr.id          as project_id,
  pr.slug        as project_slug,
  pr.name        as project_name,
  pr.project_type,
  pr.delivery_date,
  pa.id          as page_id,
  pa.slug        as page_slug,
  pa.name        as page_name,
  pa.template_id,
  pa.content     as page_content,
  pa.position    as page_position,
  pa.created_at  as page_created_at,
  pa.updated_at  as page_updated_at
from public.profiles p
join public.projects pr on pr.profile_id = p.id
join public.pages    pa on pa.project_id = pr.id
where p.is_owner = false
  and p.is_published = true
  and p.slug is not null
  and pr.is_published = true
  and pa.is_published = true;

grant select on public.client_pages to anon, authenticated;
