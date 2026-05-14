"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type UpdateOwnerState = {
  status: "idle" | "success" | "error";
  error?: string;
};

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

export async function updateOwnerProfile(
  _prev: UpdateOwnerState,
  formData: FormData,
): Promise<UpdateOwnerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", error: "Session expirée. Reconnecte-toi." };
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    return { status: "error", error: "Accès réservé au propriétaire." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: "error",
      error:
        "SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local — impossible d'écrire dans Supabase.",
    };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const avatarUrlRaw = String(formData.get("avatar_url") ?? "").trim();

  if (fullName.length < 2) {
    return {
      status: "error",
      error: "Le nom affiché doit faire au moins 2 caractères.",
    };
  }

  let avatarUrl: string | null = null;
  if (avatarUrlRaw.length > 0) {
    if (!URL_REGEX.test(avatarUrlRaw)) {
      return {
        status: "error",
        error: "L'URL de l'avatar doit commencer par http(s)://",
      };
    }
    avatarUrl = avatarUrlRaw;
  }

  const admin = createAdminClient();

  // Lookup du profil owner — on assume au plus une ligne is_owner=true.
  const { data: ownerRow, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_owner", true)
    .maybeSingle();

  if (lookupError) {
    console.error("[updateOwnerProfile] lookup error:", lookupError);
    return { status: "error", error: lookupError.message };
  }

  if (!ownerRow) {
    // Pas de profil owner existant : on en crée un. La colonne is_owner est
    // protégée par RLS au niveau service-role uniquement.
    const { error: insertError } = await admin.from("profiles").insert({
      full_name: fullName,
      avatar_url: avatarUrl,
      is_owner: true,
      is_published: false,
    });
    if (insertError) {
      console.error("[updateOwnerProfile] insert error:", insertError);
      return { status: "error", error: insertError.message };
    }
  } else {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ full_name: fullName, avatar_url: avatarUrl })
      .eq("id", ownerRow.id);
    if (updateError) {
      console.error("[updateOwnerProfile] update error:", updateError);
      return { status: "error", error: updateError.message };
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/profile");
  return { status: "success" };
}
