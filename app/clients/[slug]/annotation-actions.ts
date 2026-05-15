"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionCookieName, verifySession } from "@/lib/crypto";
import { isValidSlug } from "@/lib/slug";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLORS = ["yellow", "green", "pink", "blue"] as const;
type Color = (typeof COLORS)[number];

const TARGET_KINDS = ["page", "context"] as const;
type TargetKind = (typeof TARGET_KINDS)[number];

const MAX_EXACT = 4000;
const MAX_CONTEXT = 64;
const MAX_COMMENT = 2000;

export type Annotation = {
  id: string;
  target_kind: TargetKind;
  target_id: string;
  color: Color;
  anchor_exact: string;
  anchor_prefix: string;
  anchor_suffix: string;
  comment: string | null;
  created_at: string;
};

type AnnotationRow = {
  id: string;
  profile_id: string;
  target_kind: string;
  target_id: string;
  color: string;
  anchor_exact: string;
  anchor_prefix: string;
  anchor_suffix: string;
  comment: string | null;
  created_at: string;
};

function normalizeComment(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_COMMENT) return trimmed.slice(0, MAX_COMMENT);
  return trimmed;
}

async function resolveProfileBySlug(
  slug: string,
): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  if (!isValidSlug(slug)) return { ok: false, error: "Slug invalide." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_spaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!data?.id) return { ok: false, error: "Espace introuvable." };
  return { ok: true, profileId: data.id };
}

async function requireUnlocked(
  clientSlug: string,
): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  const resolved = await resolveProfileBySlug(clientSlug);
  if (!resolved.ok) return resolved;
  const cookieStore = await cookies();
  const value = cookieStore.get(getSessionCookieName(resolved.profileId))?.value;
  if (!verifySession(resolved.profileId, value)) {
    return { ok: false, error: "Espace verrouillé." };
  }
  return { ok: true, profileId: resolved.profileId };
}

function normalizeColor(raw: unknown): Color | null {
  return typeof raw === "string" && (COLORS as readonly string[]).includes(raw)
    ? (raw as Color)
    : null;
}
function normalizeTargetKind(raw: unknown): TargetKind | null {
  return typeof raw === "string" &&
    (TARGET_KINDS as readonly string[]).includes(raw)
    ? (raw as TargetKind)
    : null;
}

export type ListAnnotationsResult =
  | { ok: true; annotations: Annotation[] }
  | { ok: false; error: string };

export async function listAnnotationsForTarget(input: {
  clientSlug: string;
  targetKind: TargetKind;
  targetId: string;
}): Promise<ListAnnotationsResult> {
  const auth = await requireUnlocked(input.clientSlug);
  if (!auth.ok) return { ok: false, error: auth.error };

  const targetKind = normalizeTargetKind(input.targetKind);
  if (!targetKind) return { ok: false, error: "target_kind invalide." };
  if (!UUID_REGEX.test(input.targetId)) {
    return { ok: false, error: "target_id invalide." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_annotations" as never)
    .select(
      "id, profile_id, target_kind, target_id, color, anchor_exact, anchor_prefix, anchor_suffix, comment, created_at",
    )
    .eq("profile_id", auth.profileId)
    .eq("target_kind", targetKind)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: true })
    .returns<AnnotationRow[]>();

  if (error) {
    console.error("[listAnnotationsForTarget] error:", error);
    return { ok: false, error: error.message };
  }

  const annotations: Annotation[] = (data ?? []).map((row) => ({
    id: row.id,
    target_kind: row.target_kind as TargetKind,
    target_id: row.target_id,
    color: row.color as Color,
    anchor_exact: row.anchor_exact,
    anchor_prefix: row.anchor_prefix,
    anchor_suffix: row.anchor_suffix,
    comment: row.comment,
    created_at: row.created_at,
  }));

  return { ok: true, annotations };
}

export type CreateAnnotationResult =
  | { ok: true; annotation: Annotation }
  | { ok: false; error: string };

export async function createAnnotation(input: {
  clientSlug: string;
  targetKind: TargetKind;
  targetId: string;
  color: Color;
  exact: string;
  prefix: string;
  suffix: string;
  comment?: string | null;
}): Promise<CreateAnnotationResult> {
  const auth = await requireUnlocked(input.clientSlug);
  if (!auth.ok) return { ok: false, error: auth.error };

  const targetKind = normalizeTargetKind(input.targetKind);
  if (!targetKind) return { ok: false, error: "target_kind invalide." };
  if (!UUID_REGEX.test(input.targetId)) {
    return { ok: false, error: "target_id invalide." };
  }
  const color = normalizeColor(input.color);
  if (!color) return { ok: false, error: "Couleur invalide." };

  const exact = (input.exact ?? "").trim();
  if (exact.length === 0) return { ok: false, error: "Sélection vide." };
  if (exact.length > MAX_EXACT) {
    return { ok: false, error: "Sélection trop longue." };
  }
  const prefix = (input.prefix ?? "").slice(-MAX_CONTEXT);
  const suffix = (input.suffix ?? "").slice(0, MAX_CONTEXT);

  // Vérifie que la cible existe pour ce profil
  const admin = createAdminClient();
  if (targetKind === "page") {
    const { data: page } = await admin
      .from("pages")
      .select("id, project_id, projects!inner(profile_id, is_published), is_published")
      .eq("id", input.targetId)
      .maybeSingle<{
        id: string;
        is_published: boolean;
        projects: { profile_id: string; is_published: boolean } | null;
      }>();
    if (
      !page ||
      !page.projects ||
      page.projects.profile_id !== auth.profileId ||
      !page.is_published ||
      !page.projects.is_published
    ) {
      return { ok: false, error: "Page introuvable ou non publiée." };
    }
  } else {
    const { data: ctx } = await admin
      .from("client_contexts" as never)
      .select("id, profile_id")
      .eq("id", input.targetId)
      .maybeSingle<{ id: string; profile_id: string }>();
    if (!ctx || ctx.profile_id !== auth.profileId) {
      return { ok: false, error: "Note introuvable." };
    }
  }

  const comment = normalizeComment(input.comment);

  const { data: inserted, error } = await admin
    .from("client_annotations" as never)
    .insert({
      profile_id: auth.profileId,
      target_kind: targetKind,
      target_id: input.targetId,
      color,
      anchor_exact: exact,
      anchor_prefix: prefix,
      anchor_suffix: suffix,
      comment,
    } as never)
    .select(
      "id, profile_id, target_kind, target_id, color, anchor_exact, anchor_prefix, anchor_suffix, comment, created_at",
    )
    .single<AnnotationRow>();

  if (error || !inserted) {
    console.error("[createAnnotation] error:", error);
    return { ok: false, error: error?.message ?? "Création impossible." };
  }

  return {
    ok: true,
    annotation: {
      id: inserted.id,
      target_kind: inserted.target_kind as TargetKind,
      target_id: inserted.target_id,
      color: inserted.color as Color,
      anchor_exact: inserted.anchor_exact,
      anchor_prefix: inserted.anchor_prefix,
      anchor_suffix: inserted.anchor_suffix,
      comment: inserted.comment,
      created_at: inserted.created_at,
    },
  };
}

export type UpdateAnnotationCommentResult =
  | { ok: true; comment: string | null }
  | { ok: false; error: string };

export async function updateAnnotationComment(input: {
  clientSlug: string;
  annotationId: string;
  comment: string | null;
}): Promise<UpdateAnnotationCommentResult> {
  const auth = await requireUnlocked(input.clientSlug);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.annotationId)) {
    return { ok: false, error: "Annotation invalide." };
  }

  const comment = normalizeComment(input.comment);

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_annotations" as never)
    .update({ comment } as never)
    .eq("id", input.annotationId)
    .eq("profile_id", auth.profileId);

  if (error) {
    console.error("[updateAnnotationComment] error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, comment };
}

export type DeleteAnnotationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteAnnotation(input: {
  clientSlug: string;
  annotationId: string;
}): Promise<DeleteAnnotationResult> {
  const auth = await requireUnlocked(input.clientSlug);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.annotationId)) {
    return { ok: false, error: "Annotation invalide." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_annotations" as never)
    .delete()
    .eq("id", input.annotationId)
    .eq("profile_id", auth.profileId);

  if (error) {
    console.error("[deleteAnnotation] error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${input.clientSlug}`);
  return { ok: true };
}
