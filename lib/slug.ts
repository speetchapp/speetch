/**
 * Génération de slug propre à partir d'un `full_name`.
 *
 *   "Atelier Léa Müller — 2026"  →  "atelier-lea-muller-2026"
 *
 * Couvre :
 *  - diacritiques (NFD + suppression des marques combinantes)
 *  - apostrophes typographiques (’, ʼ, ')
 *  - ponctuation, espaces multiples
 *  - longueur max 80 caractères
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’ʼ`´]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Trouve un slug libre. Reçoit une fonction `exists` qui décide si un
 * candidat est déjà pris (lookup BDD à fournir par l'appelant).
 *
 *   const slug = await ensureUniqueSlug("atelier-lea", async (s) => {
 *     const { data } = await supabase
 *       .from("profiles").select("id").eq("slug", s).maybeSingle();
 *     return !!data;
 *   });
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const normalized = base || "espace-client";
  let candidate = normalized;
  let n = 2;

  // eslint-disable-next-line no-await-in-loop
  while (await exists(candidate)) {
    candidate = `${normalized}-${n}`;
    n += 1;
    if (n > 999) {
      throw new Error(
        `Impossible de générer un slug unique à partir de "${base}"`,
      );
    }
  }

  return candidate;
}

/**
 * Valide qu'un slug est sain (utilisé en garde dans les routes dynamiques).
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}
