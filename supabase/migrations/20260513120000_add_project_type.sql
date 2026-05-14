-- ============================================================================
-- Speetch — Ajoute la colonne project_type sur profiles
-- ----------------------------------------------------------------------------
-- Catégorise les Espaces Clients selon une liste prédéfinie côté app
-- (cf. lib/project-types.ts). Pas de check constraint en BDD : la validation
-- est faite dans le Server Action via isValidProjectType().
-- ============================================================================

alter table public.profiles add column if not exists project_type text;
