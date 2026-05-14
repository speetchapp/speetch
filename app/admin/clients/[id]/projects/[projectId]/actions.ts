"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PageContent } from "@/types/database";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "page-media";

type DeleteProjectInput = {
  profileId: string;
  projectId: string;
};

export type DeleteProjectResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireOwnerAndAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Session expirée. Reconnecte-toi." };
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    return { ok: false as const, error: "Accès réservé au propriétaire." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      error:
        "SUPABASE_SERVICE_ROLE_KEY manquant — impossible d'écrire dans Supabase.",
    };
  }

  return { ok: true as const, admin: createAdminClient() };
}

function extractStoragePath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

/**
 * Supprime un projet et tous ses contenus :
 *  - les pages sont supprimées automatiquement (FK pages.project_id on delete cascade)
 *  - le bucket page-media contient deux familles de fichiers liés au projet :
 *    1. `projects/{projectId}/...` (médiathèque)
 *    2. n'importe quel chemin référencé dans une section.media des pages
 *  → on liste les deux et on les remove avant le DELETE.
 */
export async function deleteProject(
  input: DeleteProjectInput,
): Promise<DeleteProjectResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }

  // Vérifie que le projet appartient bien à ce client.
  const { data: project, error: fetchError } = await auth.admin
    .from("projects")
    .select("id, profile_id")
    .eq("id", input.projectId)
    .maybeSingle();

  if (fetchError || !project) {
    return { ok: false, error: "Projet introuvable." };
  }
  if (project.profile_id !== input.profileId) {
    return { ok: false, error: "Projet introuvable." };
  }

  // 1) Collecte tous les chemins de média référencés par les pages du projet.
  const { data: pages } = await auth.admin
    .from("pages")
    .select("content")
    .eq("project_id", input.projectId);

  const mediaPaths = new Set<string>();
  for (const p of pages ?? []) {
    const content = (p.content as PageContent) ?? {};
    for (const section of content.sections ?? []) {
      for (const m of section.media ?? []) {
        const path = extractStoragePath(m.url);
        if (path) mediaPaths.add(path);
      }
    }
  }

  // 2) Liste la médiathèque du projet (bucket page-media → projects/{id}/...).
  const { data: libFiles } = await auth.admin.storage
    .from(BUCKET)
    .list(`projects/${input.projectId}`, { limit: 1000 });
  for (const f of libFiles ?? []) {
    if (f.name && !f.name.startsWith(".")) {
      mediaPaths.add(`projects/${input.projectId}/${f.name}`);
    }
  }

  // 3) Remove. Supabase storage accepte un batch jusqu'à 1000 paths.
  if (mediaPaths.size > 0) {
    const paths = Array.from(mediaPaths);
    const { error: removeError } = await auth.admin.storage
      .from(BUCKET)
      .remove(paths);
    if (removeError) {
      console.error("[deleteProject] storage.remove error:", removeError);
      // On n'arrête pas — même si le storage cleanup partiel échoue, on supprime
      // le projet en DB pour ne pas laisser de zombie.
    }
  }

  // 4) DELETE projet (les pages cascade-delete via la FK).
  const { error } = await auth.admin
    .from("projects")
    .delete()
    .eq("id", input.projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.profileId}/projects/${input.projectId}`);
  return { ok: true };
}
