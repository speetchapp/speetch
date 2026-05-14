import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createBaseSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Client Supabase pour le runtime serveur — Server Components,
 * Server Actions, Route Handlers. Lit/écrit les cookies via `next/headers`.
 *
 * Next.js 15 : `cookies()` est désormais asynchrone.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: CookieOptions;
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component pur : `set` n'est pas autorisé.
            // Le middleware se charge de rafraîchir la session sur les
            // requêtes suivantes — on peut ignorer en toute sécurité.
          }
        },
      },
    },
  );
}

/**
 * Client Supabase service-role — bypass RLS, accès complet sur toutes les tables.
 * À utiliser UNIQUEMENT côté serveur, jamais exposée au navigateur.
 *
 * IMPORTANT : on utilise `@supabase/supabase-js` brut (PAS `@supabase/ssr`)
 * pour ne JAMAIS lire les cookies de session. Sinon, quand un utilisateur
 * est connecté, son JWT `authenticated` outrepasse la clé service-role
 * passée en argument et le client requête en `authenticated` (rôle révoqué
 * sur `profiles`).
 */
export function createAdminClient() {
  return createBaseSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
