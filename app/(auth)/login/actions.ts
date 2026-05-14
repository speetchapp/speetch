"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Server Action — envoie un magic link Supabase au propriétaire.
 *
 * Gate : si SPEETCH_OWNER_EMAIL est défini, seul cet email peut recevoir un
 * lien. Toute autre adresse reçoit une fausse confirmation pour ne pas
 * révéler l'existence du compte.
 */
export async function signInWithMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const redirect = String(formData.get("redirect") ?? "/admin");

  if (!email || !EMAIL_REGEX.test(email)) {
    return { status: "error", message: "Adresse e-mail invalide." };
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();

  if (ownerEmail && email !== ownerEmail) {
    // Pas de leak — fausse confirmation.
    return {
      status: "success",
      message:
        "Si cette adresse est autorisée, un lien vient d'être envoyé.",
    };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message || "Authentification impossible.",
    };
  }

  return {
    status: "success",
    message: "Lien magique envoyé. Vérifie ta boîte de réception.",
  };
}
