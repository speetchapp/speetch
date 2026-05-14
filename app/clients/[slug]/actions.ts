"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import {
  SESSION_DURATION_SECONDS,
  getSessionCookieName,
  signSession,
  verifyPassword,
} from "@/lib/crypto";
import { isValidSlug } from "@/lib/slug";

export type UnlockState = {
  status: "idle" | "error";
  error?: string;
};

/** Délai constant minimum sur un échec d'auth (anti-timing brute-force). */
const MIN_FAILURE_DELAY_MS = 350;

async function failure(
  message: string,
  startedAt: number,
): Promise<UnlockState> {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_FAILURE_DELAY_MS - elapsed;
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }
  return { status: "error", error: message };
}

/**
 * Server Action — déverrouille un Espace Client.
 *
 * Lookup via clé service-role (RLS bypass) car la table `profiles` est
 * révoquée pour anon. Vérifie le hash scrypt + pepper, puis pose un cookie
 * httpOnly signé HMAC-SHA256, scopé au path `/clients/<slug>`.
 */
export async function unlockClientSpace(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const startedAt = Date.now();

  const slug = String(formData.get("slug") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!slug || !isValidSlug(slug)) {
    return failure("Lien invalide.", startedAt);
  }
  if (!password) {
    return failure("Mot de passe requis.", startedAt);
  }

  const admin = await createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, password_hash, password_salt, is_published, is_owner")
    .eq("slug", slug)
    .eq("is_owner", false)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !profile.is_published ||
    !profile.password_hash ||
    !profile.password_salt
  ) {
    return failure("Identifiants incorrects.", startedAt);
  }

  const ok = verifyPassword(
    password,
    profile.password_hash,
    profile.password_salt,
  );
  if (!ok) {
    return failure("Identifiants incorrects.", startedAt);
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const value = signSession(profile.id, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(profile.id), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: `/clients/${slug}`,
  });

  revalidatePath(`/clients/${slug}`);
  redirect(`/clients/${slug}`);
}

/**
 * Server Action — verrouille à nouveau l'espace (suppression du cookie).
 * Reçoit `slug` + `profile_id` depuis des champs cachés rendus par le
 * Server Component, donc valeurs de confiance.
 */
export async function lockClientSpace(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!isValidSlug(slug) || !/^[0-9a-f-]{36}$/i.test(profileId)) {
    redirect("/");
  }

  const cookieStore = await cookies();
  cookieStore.delete({
    name: getSessionCookieName(profileId),
    path: `/clients/${slug}`,
  });

  redirect(`/clients/${slug}`);
}
