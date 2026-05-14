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
import type { CreateTemplateState } from "./actions-types";

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

export async function createTemplateFromHtml(
  _prev: CreateTemplateState,
  formData: FormData,
): Promise<CreateTemplateState> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { status: "error", error: auth.error };

  // Validation des champs admin
  const label = String(formData.get("label") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  const file = formData.get("file");
  const fidelity = String(formData.get("fidelity") ?? "edit").trim();
  const isRawHtml = fidelity === "raw";

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

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Aucun fichier HTML reçu." };
  }
  if (file.size > MAX_HTML_SIZE) {
    return {
      status: "error",
      error: "Fichier HTML trop volumineux (max 2 MB).",
    };
  }

  const html = await file.text();
  if (html.trim().length < 20) {
    return { status: "error", error: "HTML trop court pour être exploitable." };
  }

  // Mode "édition libre" : on a besoin de l'API Claude. En "reproduction
  // fidèle", on saute cet appel donc pas besoin de la clé.
  if (!isRawHtml && !process.env.ANTHROPIC_API_KEY) {
    return {
      status: "error",
      error:
        "ANTHROPIC_API_KEY manquante dans .env.local — impossible d'appeler l'API Claude.",
    };
  }

  let defaultContent;
  if (isRawHtml) {
    defaultContent = buildRawHtmlContent(html);
  } else {
    const result = await convertHtmlToPageContent(html);
    if (!result.ok) {
      return { status: "error", error: result.error };
    }
    defaultContent = result.content;
  }

  const { error: insertError } = await auth.admin
    .from("page_templates")
    .insert({
      label,
      tagline: tagline || null,
      description: description || null,
      project_type: projectType,
      default_content: defaultContent,
      source_html: html,
    });

  if (insertError) {
    console.error("[createTemplateFromHtml] insert error:", insertError);
    return {
      status: "error",
      error: insertError.message || "Erreur d'insertion en base.",
    };
  }

  revalidatePath("/admin/templates");
  redirect("/admin/templates");
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) {
    console.error("[deleteTemplate] auth failed:", auth.error);
    return;
  }

  const id = String(formData.get("template_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    console.error("[deleteTemplate] invalid id:", id);
    return;
  }

  const { error } = await auth.admin
    .from("page_templates")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[deleteTemplate] delete error:", error);
    return;
  }
  // Les pages déjà créées depuis ce template gardent leur content (copie au
  // moment de l'instanciation). Le template_id reste référencé mais devient
  // orphelin — pas grave, le lookup tombe simplement sur null côté admin.
  revalidatePath("/admin/templates");
}
