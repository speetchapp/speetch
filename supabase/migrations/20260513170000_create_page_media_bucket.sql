-- ============================================================================
-- Speetch — Bucket Storage `page-media`
-- ----------------------------------------------------------------------------
-- Les médias des sections de pages (images, vidéos) sont uploadés ici par
-- l'admin via service-role et lus publiquement par les visiteurs d'espaces
-- clients. Bucket public, pas de policy nécessaire :
--   - reads anon  → autorisés (bucket public)
--   - writes      → service-role uniquement (bypass RLS)
--
-- Path scheme : {page_id}/{section_id}/{timestamp}-{filename}.
-- Au delete d'une section / page, le code applicatif retire les fichiers
-- concernés en s'appuyant sur les URLs stockées dans `pages.content`.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-media',
  'page-media',
  true,
  52428800, -- 50 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
