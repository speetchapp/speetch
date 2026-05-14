/**
 * Détection / parsing / sérialisation d'un objet JS top-level dans un
 * `<script>` du raw_html. Utilisé pour exposer un objet de configuration
 * (ex: `const DIRECTIONS = { 1: {...}, 2: {...}, 3: {...} }`) comme un
 * éditeur à onglets.
 *
 * Hypothèses simples :
 * - L'objet est déclaré au top-level d'un `<script>` via `const|let|var`.
 * - Les valeurs sont des littéraux JS valides (strings simples/doubles/backticks,
 *   nombres, sub-objets, sub-arrays). Pas d'expressions, pas d'appels de fonction.
 * - L'évaluation se fait via `new Function("return …")()` dans le browser admin.
 *   Le owner contrôle 100% du HTML uploadé, donc on accepte ce vector.
 */

export type ExtractedObject = {
  /** Nom de la const (ex. "DIRECTIONS") */
  name: string;
  /** Littéral source (incluant `{` et `}`) */
  literal: string;
  /** Index du `{` ouvrant dans `script` */
  startInScript: number;
  /** Index APRÈS le `}` fermant dans `script` */
  endInScript: number;
  /** Index du `{` ouvrant dans le HTML complet */
  startInHtml: number;
  /** Index APRÈS le `}` fermant dans le HTML complet */
  endInHtml: number;
  /** Index du `<script>` qui contient cet objet */
  scriptIndex: number;
  /** Valeur évaluée */
  value: unknown;
};

/**
 * Trouve toutes les déclarations `const|let|var NAME = { ... };` dans les
 * `<script>` du HTML et retourne celles dont la valeur est un objet
 * littéral parsable.
 *
 * Sont ignorés : script vides, scripts avec attribut `src` (externes).
 */
export function extractTopLevelObjects(html: string): ExtractedObject[] {
  const results: ExtractedObject[] = [];

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let scriptMatch: RegExpExecArray | null;
  let scriptIndex = -1;

  // eslint-disable-next-line no-cond-assign
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    scriptIndex += 1;
    const attrs = scriptMatch[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const scriptContent = scriptMatch[2] ?? "";
    const scriptStartInHtml =
      scriptMatch.index + scriptMatch[0].indexOf(">") + 1;

    const declRegex = /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
    let declMatch: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((declMatch = declRegex.exec(scriptContent)) !== null) {
      const openBrace = scriptContent.indexOf("{", declMatch.index);
      if (openBrace < 0) continue;
      const closeBrace = findMatchingBrace(scriptContent, openBrace);
      if (closeBrace < 0) continue;
      const literal = scriptContent.slice(openBrace, closeBrace + 1);

      let value: unknown;
      try {
        // eslint-disable-next-line no-new-func
        value = new Function(`"use strict"; return (${literal});`)();
      } catch {
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;

      results.push({
        name: declMatch[1],
        literal,
        startInScript: openBrace,
        endInScript: closeBrace + 1,
        startInHtml: scriptStartInHtml + openBrace,
        endInHtml: scriptStartInHtml + closeBrace + 1,
        scriptIndex,
        value,
      });
    }
  }

  return results;
}

/**
 * Sélection heuristique de l'objet "tabs" :
 * - Toutes les clés top-level sont des entiers décimaux (1, 2, 3…)
 * - Au moins 2 clés
 * - Chaque valeur est un objet (pas une string ou nombre)
 *
 * Retourne le premier candidat trouvé, ou null.
 */
export function findTabsObject(
  candidates: ExtractedObject[],
): ExtractedObject | null {
  for (const c of candidates) {
    const obj = c.value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length < 2) continue;
    const allInt = keys.every((k) => /^[0-9]+$/.test(k));
    if (!allInt) continue;
    const allObj = keys.every(
      (k) => obj[k] !== null && typeof obj[k] === "object" && !Array.isArray(obj[k]),
    );
    if (!allObj) continue;
    return c;
  }
  return null;
}

/**
 * Trouve l'index de la `}` qui ferme la `{` à `openIndex`.
 * Tient compte des strings simples, doubles, backticks, commentaires.
 * Retourne -1 si non équilibré.
 */
function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  let inString: false | "'" | '"' | "`" = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (c === "\\") {
        i++; // skip escaped char
        continue;
      }
      if (c === inString) inString = false;
      continue;
    }
    // Not in string / comment
    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inString = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Sérialise un objet JS en littéral source-compatible (chaînes en double-quotes,
 * keys en double-quotes même si numériques, indenté 2 espaces). C'est valide
 * en JS comme en JSON, donc on garde la forme la plus simple : JSON.stringify.
 *
 * Note : on perd les variations de quotes / les commentaires éventuels du
 * littéral d'origine. C'est acceptable parce que le HTML reste fonctionnel.
 */
export function serializeObject(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Remplace un objet trouvé dans le HTML par sa nouvelle sérialisation.
 * Retourne le nouveau HTML.
 */
export function replaceInHtml(
  html: string,
  extracted: ExtractedObject,
  newValue: unknown,
): string {
  const serialized = serializeObject(newValue);
  return (
    html.slice(0, extracted.startInHtml) +
    serialized +
    html.slice(extracted.endInHtml)
  );
}

// ---------------------------------------------------------------------------
// Détection des champs feuille à éditer
// ---------------------------------------------------------------------------

export type LeafField = {
  /** Chemin canonique (ex. "copies.main", "visuals.fbSquareImg") */
  path: string;
  /** Dernier segment du chemin */
  key: string;
  /** Valeur actuelle */
  value: string;
  /** Type heuristique pour le rendu */
  kind: "image" | "html" | "text" | "longtext";
};

const IMAGE_KEY_RE = /(img|image|visual|picture|photo|cover|src)$/i;
const IMAGE_VAL_RE = /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i;
const HTML_VAL_RE = /<\/?[a-z][^>]*>/i;

function classifyLeaf(key: string, value: string): LeafField["kind"] {
  if (IMAGE_KEY_RE.test(key) || IMAGE_VAL_RE.test(value)) return "image";
  if (HTML_VAL_RE.test(value)) return "html";
  if (value.length > 80 || value.includes("\n")) return "longtext";
  return "text";
}

/**
 * Aplatit un objet en liste de champs feuille (string uniquement). Les arrays
 * sont aplaties via index dans le path.
 */
export function flattenLeaves(value: unknown, prefix = ""): LeafField[] {
  const out: LeafField[] = [];
  if (value === null || value === undefined) return out;
  if (typeof value === "string") {
    const key = prefix.split(".").pop() ?? "";
    out.push({
      path: prefix,
      key,
      value,
      kind: classifyLeaf(key, value),
    });
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const key = prefix.split(".").pop() ?? "";
    out.push({
      path: prefix,
      key,
      value: String(value),
      kind: "text",
    });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      out.push(...flattenLeaves(item, prefix ? `${prefix}.${i}` : String(i)));
    });
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...flattenLeaves(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

/**
 * Met à jour une valeur feuille dans un objet en suivant un chemin pointé.
 * Mute l'objet en place et le retourne.
 */
export function setLeaf(
  root: Record<string, unknown>,
  path: string,
  newValue: string,
): void {
  const parts = path.split(".");
  let current: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current === null || typeof current !== "object") return;
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || typeof current !== "object") return;
  const lastKey = parts[parts.length - 1];
  // Conserve le type initial : string → string, number → number, bool → bool
  const existing = (current as Record<string, unknown>)[lastKey];
  if (typeof existing === "number") {
    const n = Number(newValue);
    (current as Record<string, unknown>)[lastKey] = Number.isFinite(n)
      ? n
      : newValue;
  } else if (typeof existing === "boolean") {
    (current as Record<string, unknown>)[lastKey] =
      newValue === "true" || newValue === "1";
  } else {
    (current as Record<string, unknown>)[lastKey] = newValue;
  }
}

/**
 * Clone profond d'un objet/array simple (string/number/bool/null/object/array).
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => deepClone(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as T;
}
