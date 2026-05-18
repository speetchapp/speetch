"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "error";
  message?: string;
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Server Action — connexion email + mot de passe.
 *
 * Gate : si SPEETCH_OWNER_EMAIL est défini, seul cet email peut s'authentifier.
 * Pour ne pas révéler quel compte existe, on renvoie un message générique.
 */
export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/admin");

  if (!email || !EMAIL_REGEX.test(email) || !password) {
    return { status: "error", message: "Identifiants invalides." };
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && email !== ownerEmail) {
    return { status: "error", message: "Identifiants invalides." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { status: "error", message: "Identifiants invalides." };
  }

  redirect(redirectTo);
}
