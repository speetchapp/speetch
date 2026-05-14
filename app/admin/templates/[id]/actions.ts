"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isValidProjectType } from "@/lib/project-types";
import {
  MAX_HTML_SIZE,
  buildRawHtmlContent,
  convertHtmlToPageContent,
} from "../_lib/html-conversion";
import type { UpdateTemplateState } from "./actions-types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        "SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local — impossible d'écrire dans Supabase.",
    };
  }

  return { ok: true as const, admin: createAdminClient() };
}

export async function updateTemplate(
  _prev: UpdateTemplateState,
  formData: FormData,
): Promise<UpdateTemplateState> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { status: "error", error: auth.error };

  const id = String(formData.get("template_id") ?? "").trim();
  if (!UUID_REGEX.test(id)) {
    return { status: "error", error: "Identifiant de template invalide." };
  }

  // Champs métadonnées
  const label = String(formData.get("label") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  const fidelity = String(formData.get("fidelity") ?? "edit").trim();
  const isRawHtml = fidelity === "raw";
  const file = formData.get("file");

  if (label.length < 2) {
    return {
      status: "error",
      error: "Le nom du template doit faire au moins 2 caractères.",
    };
  }

  const projectType =
    projectTypeRaw && isValidProjectType(projectTypeRaw)
      ? projectTypeRaw
      : null;

  // Met à jour les métadonnées dans tous les cas
  const baseUpdate = {
    label,
    tagline: tagline || null,
    description: description || null,
    project_type: projectType,
  };

  // Si un fichier HTML est joint, on regénère default_content + source_html
  const hasNewFile = file instanceof File && file.size > 0;

  if (hasNewFile) {
    if (file.size > MAX_HTML_SIZE) {
      return {
        status: "error",
        error: "Fichier HTML trop volumineux (max 2 MB).",
      };
    }

    const html = await file.text();
    if (html.trim().length < 20) {
      return {
        status: "error",
        error: "HTML trop court pour être exploitable.",
      };
    }

    if (!isRawHtml && !process.env.ANTHROPIC_API_KEY) {
      return {
        status: "error",
        error:
          "ANTHROPIC_API_KEY manquante dans .env.local — impossible d'appeler l'API Claude.",
      };
    }

    let nextContent;
    if (isRawHtml) {
      nextContent = buildRawHtmlContent(html);
    } else {
      const result = await convertHtmlToPageContent(html);
      if (!result.ok) {
        return { status: "error", error: result.error };
      }
      nextContent = result.content;
    }

    const { error: updateError } = await auth.admin
      .from("page_templates")
      .update({
        ...baseUpdate,
        default_content: nextContent,
        source_html: html,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[updateTemplate/withFile] update error:", updateError);
      return {
        status: "error",
        error: updateError.message || "Erreur de mise à jour en base.",
      };
    }
  } else {
    // Pas de nouveau fichier : on garde le contenu actuel. Si le mode de
    // fidélité a changé sans nouveau fichier, on le signale — on ne peut
    // pas convertir "édition libre" ↔ "raw" sans re-process l'HTML.
    const { data: current, error: fetchError } = await auth.admin
      .from("page_templates")
      .select("default_content")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !current) {
      return {
        status: "error",
        error: fetchError?.message ?? "Template introuvable.",
      };
    }

    const currentStyle =
      (current.default_content as { meta?: { style?: string } } | null)?.meta
        ?.style ?? "document";
    const currentIsRaw = currentStyle === "raw_html";

    if (currentIsRaw !== isRawHtml) {
      return {
        status: "error",
        error:
          "Pour changer le niveau de fidélité, ré-importe le fichier HTML — sinon le contenu actuel ne correspondrait plus.",
      };
    }

    const { error: updateError } = await auth.admin
      .from("page_templates")
      .update(baseUpdate)
      .eq("id", id);

    if (updateError) {
      console.error("[updateTemplate/metaOnly] update error:", updateError);
      return {
        status: "error",
        error: updateError.message || "Erreur de mise à jour en base.",
      };
    }
  }

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${id}`);
  redirect("/admin/templates");
}
