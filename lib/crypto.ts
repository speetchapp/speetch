import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Hash + vérification des mots de passe des Espaces Clients.
 *
 * Algorithme : scrypt (RFC 7914) — KDF résistant aux GPU/ASIC,
 * recommandé par OWASP au même titre qu'Argon2.
 *
 * Pepper : chaîne secrète stockée hors-BDD (env var). Ajoute une couche
 * de protection si la table fuit : sans le pepper, les hashs ne peuvent
 * pas être brute-forcés.
 *
 * Ce module utilise `node:crypto` → à n'importer QUE depuis des routes
 * en runtime Node (Server Actions, Route Handlers). Pas compatible Edge.
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Paramètres scrypt — recommandés OWASP 2024
// N = 2^15 = 32768 (cost factor), r = 8 (block size), p = 1 (parallelization)
const SCRYPT_PARAMS = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024, // 64 MB — laisse de la marge
} as const;

function getPepper(): string {
  const pepper = process.env.SPEETCH_CLIENT_PASSWORD_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error(
      "SPEETCH_CLIENT_PASSWORD_PEPPER manquant ou trop court (minimum 16 caractères).",
    );
  }
  return pepper;
}

export type HashedPassword = {
  hash: string;
  salt: string;
};

/**
 * Hash un mot de passe avec un sel aléatoire + le pepper global.
 */
export function hashPassword(password: string): HashedPassword {
  if (!password || password.length < 6) {
    throw new Error("Le mot de passe doit faire au moins 6 caractères.");
  }

  const pepper = getPepper();
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = scryptSync(
    password + pepper,
    salt,
    KEY_LENGTH,
    SCRYPT_PARAMS,
  );

  return {
    hash: derived.toString("hex"),
    salt,
  };
}

/**
 * Vérifie un mot de passe contre un hash + sel stockés.
 * Comparaison à temps constant pour éviter les attaques par timing.
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  if (!password || !hash || !salt) return false;

  try {
    const pepper = getPepper();
    const derived = scryptSync(
      password + pepper,
      salt,
      KEY_LENGTH,
      SCRYPT_PARAMS,
    );
    const stored = Buffer.from(hash, "hex");

    if (stored.length !== derived.length) return false;
    return timingSafeEqual(stored, derived);
  } catch {
    return false;
  }
}

/**
 * Génère un mot de passe lisible pour un nouvel Espace Client.
 * Format : 3 mots séparés de tirets (longueur ~22 caractères) +
 * un nombre aléatoire à 3 chiffres pour rappel.
 *
 *   "voile-cuivre-aurore-482"
 */
const WORDS = [
  "aurore", "brique", "cuivre", "drape", "echo",
  "fjord", "givre", "hublot", "icare", "jadis",
  "kraft", "linon", "marbre", "neon", "ocre",
  "pomelo", "quartz", "ruche", "sablier", "tilde",
  "ursin", "voile", "wadi", "xylem", "yucca", "zenith",
] as const;

export function generateClientPassword(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `${pick()}-${pick()}-${pick()}-${num}`;
}

// ============================================================================
// Cookie de session pour les Espaces Clients
// ----------------------------------------------------------------------------
// Mécanique : on signe un payload `${version}.${profile_id}.${expires_at}`
// avec HMAC-SHA256(pepper). Le cookie stocke `${expires_at}.${signature}`.
// La vérification est en temps constant.
// ============================================================================

const SESSION_VERSION = "v1";

/** 7 jours — durée de vie d'un cookie d'espace client */
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

/** Nom de cookie scopé sur l'id du profil (pas le slug, qui peut changer). */
export function getSessionCookieName(profileId: string): string {
  return `speetch_unlock_${profileId.replace(/-/g, "")}`;
}

/** Signe une session pour `profileId` valable jusqu'à `expiresAt` (epoch s). */
export function signSession(profileId: string, expiresAt: number): string {
  const pepper = getPepper();
  const payload = `${SESSION_VERSION}.${profileId}.${expiresAt}`;
  const sig = createHmac("sha256", pepper).update(payload).digest("hex");
  return `${expiresAt}.${sig}`;
}

/** Vérifie une valeur de cookie. Renvoie false si invalide ou expirée. */
export function verifySession(
  profileId: string,
  value: string | undefined,
): boolean {
  if (!value) return false;
  try {
    const dotIndex = value.indexOf(".");
    if (dotIndex <= 0) return false;
    const expiresStr = value.slice(0, dotIndex);
    const sig = value.slice(dotIndex + 1);
    if (!sig) return false;

    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt)) return false;
    if (expiresAt * 1000 < Date.now()) return false;

    const pepper = getPepper();
    const payload = `${SESSION_VERSION}.${profileId}.${expiresAt}`;
    const expected = createHmac("sha256", pepper).update(payload).digest("hex");

    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
