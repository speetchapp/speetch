/**
 * Types des Server Actions raw_html (partagés client/serveur).
 * Hors fichier "use server" parce que ce dernier ne peut exporter que des
 * async functions.
 */

export type SaveOverridesResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProjectMediaItem = {
  path: string;
  url: string;
  name: string;
  size: number;
  createdAt: string;
};

export type ListProjectMediaResult =
  | { ok: true; items: ProjectMediaItem[] }
  | { ok: false; error: string };

export type UploadProjectMediaResult =
  | { ok: true; item: ProjectMediaItem }
  | { ok: false; error: string };

export type DeleteProjectMediaResult =
  | { ok: true }
  | { ok: false; error: string };
