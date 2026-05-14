-- ============================================================================
-- Speetch — Initialisation de la table `profiles`
-- ----------------------------------------------------------------------------
-- La table accueille DEUX types de lignes :
--   1. La ligne unique du propriétaire (is_owner = true), liée à auth.uid()
--   2. Les "Espaces Clients" (is_owner = false), standalone, non liés à auth
--
-- Aucune FK vers auth.users : les espaces clients n'ont pas de compte auth.
-- ----------------------------------------------------------------------------
-- Migration idempotente — peut être rejouée sans risque.
-- ============================================================================

begin;

-- ------------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- 2. Table `profiles` — schéma complet
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid        primary key default gen_random_uuid(),
  full_name     text,
  avatar_url    text,
  slug          text,
  is_owner      boolean     not null default false,
  is_published  boolean     not null default false,
  password_hash text,
  password_salt text,
  client_email  text,
  subtitle      text,
  content       jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Garde-fou : si la table existait déjà avec un schéma plus court,
-- on rattrape les colonnes manquantes.
alter table public.profiles add column if not exists slug          text;
alter table public.profiles add column if not exists is_owner      boolean     not null default false;
alter table public.profiles add column if not exists is_published  boolean     not null default false;
alter table public.profiles add column if not exists password_hash text;
alter table public.profiles add column if not exists password_salt text;
alter table public.profiles add column if not exists client_email  text;
alter table public.profiles add column if not exists subtitle      text;
alter table public.profiles add column if not exists content       jsonb       not null default '{}'::jsonb;
alter table public.profiles add column if not exists created_at    timestamptz not null default now();
alter table public.profiles add column if not exists updated_at    timestamptz not null default now();

-- Aucune FK vers auth.users sur `id` (les espaces clients sont standalone).
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- ------------------------------------------------------------------
-- 3. Contraintes & index
-- ------------------------------------------------------------------

-- Slug unique (quand présent)
create unique index if not exists profiles_slug_unique_idx
  on public.profiles (slug)
  where slug is not null;

-- Un seul propriétaire possible
create unique index if not exists profiles_single_owner_idx
  on public.profiles ((is_owner))
  where is_owner = true;

-- Slug obligatoire pour les espaces clients
alter table public.profiles
  drop constraint if exists profiles_client_requires_slug;
alter table public.profiles
  add constraint profiles_client_requires_slug
  check (is_owner = true or slug is not null);

-- Pour être publié, un espace client doit avoir slug + hash + salt
alter table public.profiles
  drop constraint if exists profiles_published_requires_credentials;
alter table public.profiles
  add constraint profiles_published_requires_credentials
  check (
    is_published = false
    or (slug is not null and password_hash is not null and password_salt is not null)
  );

-- ------------------------------------------------------------------
-- 4. Trigger updated_at
-- ------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- 5. Vue publique `client_spaces`
--    Exposée à anon/authenticated SANS les colonnes sensibles
--    (password_hash, password_salt, client_email).
-- ------------------------------------------------------------------
-- security_invoker = false : la vue s'exécute avec les droits du owner
-- (postgres), ce qui bypass la révocation d'anon sur public.profiles.
-- Safe car la vue projette uniquement les colonnes publiques et filtre
-- déjà sur is_published = true et is_owner = false.
create or replace view public.client_spaces
  with (security_invoker = false) as
  select
    id,
    slug,
    full_name,
    avatar_url,
    subtitle,
    content,
    created_at
  from public.profiles
  where is_published = true
    and is_owner = false
    and slug is not null;

-- ------------------------------------------------------------------
-- 6. Row-Level Security
--    Table profiles  : aucune policy → tout bloqué pour anon/authenticated.
--                      Les opérations admin passent par la clé service-role
--                      (qui bypass RLS automatiquement).
--    Vue client_spaces : lecture publique (la vue filtre déjà les rows
--                       publiées et les colonnes safe).
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Nettoyer d'anciennes policies templates Supabase, si présentes
drop policy if exists "Profiles are viewable by everyone."        on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile."       on public.profiles;
drop policy if exists "Users can update own profile."             on public.profiles;
drop policy if exists "profiles_select_published"                 on public.profiles;

revoke all   on public.profiles      from anon, authenticated;
grant select on public.client_spaces to anon, authenticated;

commit;

-- ============================================================================
-- BOOTSTRAP DU PROPRIÉTAIRE
-- ----------------------------------------------------------------------------
-- À exécuter UNE FOIS, après ta première connexion via le magic link
-- (qui aura créé la ligne dans auth.users). Remplace l'email par celui
-- défini dans SPEETCH_OWNER_EMAIL.
-- ============================================================================
--
-- insert into public.profiles (id, full_name, is_owner, is_published)
-- select id, coalesce(raw_user_meta_data ->> 'full_name', email), true, false
--   from auth.users
--  where email = 'TON_EMAIL@speetch.fr'
-- on conflict (id) do update
--   set is_owner = true;
