/**
 * Types et générateurs pour les graphiques injectés dans une note de
 * contexte (raw_html). V1 : bar chart uniquement, mais l'architecture
 * (ChartConfig + dispatch par type) est prête pour line/donut/area.
 *
 * Le SVG produit est volontairement statique et inline — pas de JS dans
 * l'iframe, le rendu reste correct même en copier-coller ou en export.
 * Esthétique Speetch : monochrome, sans-serif léger, hairline grid.
 */

export type ChartType = "bar";

export type ChartConfig = {
  type: ChartType;
  title?: string;
  /** Orientation des barres pour `type === "bar"`. */
  orientation?: "vertical" | "horizontal";
  /** Étiquettes de l'axe catégoriel (X pour vertical, Y pour horizontal). */
  labels: string[];
  /** Valeurs numériques associées (même longueur que labels). */
  values: number[];
  /** Libellé de l'axe catégoriel (optionnel). */
  xLabel?: string;
  /** Libellé de l'axe des valeurs (optionnel). */
  yLabel?: string;
};

const CHART_MARKER_ATTR = "data-speetch-chart";

/**
 * Parse un nombre au format français (1 234,56 ou 1,234.56 ou 1234,56)
 * ou anglais. Renvoie null si non-parsable. Tolère le symbole €/% en
 * suffixe et les espaces / espaces insécables comme séparateur de
 * milliers.
 */
export function parseLooseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[  ]/g, "") // espaces insécables
    .replace(/\s/g, "")
    .replace(/[€$%]/g, "")
    .trim();
  if (cleaned.length === 0) return null;
  // Si présence de virgule ET point : on suppose la virgule = millier, le
  // point = décimal (format anglais avec milliers à virgule).
  // Sinon : la virgule est traitée comme séparateur décimal (français).
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // anglais : 1,234.56 — on enlève les virgules
    normalized = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(/,/g, ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrait les en-têtes et lignes d'un <table>. Renvoie null si la table
 * est vide. La première ligne est considérée comme en-tête si elle
 * contient au moins une <th> ou s'il y a plus d'une ligne.
 */
export function parseTableElement(table: HTMLTableElement): {
  headers: string[];
  rows: string[][];
} | null {
  const allRows = Array.from(table.rows);
  if (allRows.length === 0) return null;

  const firstRowHasTh = Array.from(allRows[0].cells).some(
    (c) => c.tagName === "TH",
  );
  let headers: string[];
  let dataRowsSource: HTMLTableRowElement[];
  if (firstRowHasTh || allRows.length > 1) {
    headers = Array.from(allRows[0].cells).map((c) =>
      (c.textContent ?? "").trim(),
    );
    dataRowsSource = allRows.slice(1);
  } else {
    // Une seule ligne, sans <th> : on génère des en-têtes Col 1, Col 2…
    const cellCount = allRows[0].cells.length;
    headers = Array.from({ length: cellCount }, (_, i) => `Col ${i + 1}`);
    dataRowsSource = allRows;
  }

  const rows = dataRowsSource.map((tr) =>
    Array.from(tr.cells).map((c) => (c.textContent ?? "").trim()),
  );
  if (rows.length === 0) return null;
  return { headers, rows };
}

/**
 * Heuristique pour deviner les colonnes par défaut : X = première colonne
 * non entièrement numérique, Y = première colonne contenant au moins une
 * valeur numérique parmi les autres.
 */
export function guessChartColumns(
  headers: string[],
  rows: string[][],
): { xColumnIndex: number; yColumnIndex: number } {
  const colCount = headers.length;
  const numericRatio = (col: number) => {
    let total = 0;
    let numeric = 0;
    for (const r of rows) {
      const cell = r[col];
      if (cell === undefined || cell === "") continue;
      total += 1;
      if (parseLooseNumber(cell) !== null) numeric += 1;
    }
    return total === 0 ? 0 : numeric / total;
  };

  let xColumnIndex = 0;
  let yColumnIndex = colCount > 1 ? 1 : 0;
  // X : première colonne avec ratio numérique <= 0.3 (= du texte)
  for (let c = 0; c < colCount; c++) {
    if (numericRatio(c) <= 0.3) {
      xColumnIndex = c;
      break;
    }
  }
  // Y : première colonne suivante avec ratio numérique > 0.5
  for (let c = 0; c < colCount; c++) {
    if (c === xColumnIndex) continue;
    if (numericRatio(c) > 0.5) {
      yColumnIndex = c;
      break;
    }
  }
  return { xColumnIndex, yColumnIndex };
}

/**
 * Construit une ChartConfig à partir d'en-têtes + lignes texte + choix
 * de colonnes. Filtre les lignes sans valeur Y numérique.
 */
export function buildChartConfigFromRows(input: {
  headers: string[];
  rows: string[][];
  type: ChartType;
  xColumnIndex: number;
  yColumnIndex: number;
  title?: string;
  orientation?: "vertical" | "horizontal";
}): ChartConfig | null {
  const labels: string[] = [];
  const values: number[] = [];
  for (const row of input.rows) {
    const labelRaw = row[input.xColumnIndex] ?? "";
    const valueRaw = row[input.yColumnIndex] ?? "";
    const value = parseLooseNumber(valueRaw);
    if (value === null) continue;
    labels.push(labelRaw || "—");
    values.push(value);
  }
  if (labels.length === 0) return null;
  return {
    type: input.type,
    title: input.title,
    orientation: input.orientation ?? "vertical",
    labels,
    values,
    xLabel: input.headers[input.xColumnIndex],
    yLabel: input.headers[input.yColumnIndex],
  };
}

/**
 * Sérialise une ChartConfig dans l'attribut data-speetch-chart d'un
 * <figure>, et y embed le SVG généré. Format choisi pour que le clic
 * sur le graphique puisse re-lire la config et rouvrir la modal.
 */
export function buildChartFigureHtml(config: ChartConfig): string {
  const svg = generateChartSvg(config);
  const json = JSON.stringify(config).replace(/'/g, "&#39;");
  const safeTitle = (config.title ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const captionHtml = safeTitle
    ? `<figcaption style="margin-top: 0.75rem; text-align: center; font-family: ui-serif, Georgia, serif; font-style: italic; font-size: 0.875rem; color: #666;">${safeTitle}</figcaption>`
    : "";
  return `<figure ${CHART_MARKER_ATTR}='${json}' class="speetch-chart-block" style="margin: 2.5rem 0; padding: 1.5rem 1rem; background: #fdfcf8; border: 1px solid #eae5da; border-radius: 8px;">
${svg}
${captionHtml}
</figure>`;
}

/**
 * Parse l'attribut data-speetch-chart d'un <figure>. Renvoie null si
 * absent ou JSON invalide.
 */
export function parseChartFigure(fig: Element): ChartConfig | null {
  const raw = fig.getAttribute(CHART_MARKER_ATTR);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChartConfig>;
    if (
      parsed.type !== "bar" ||
      !Array.isArray(parsed.labels) ||
      !Array.isArray(parsed.values) ||
      parsed.labels.length !== parsed.values.length
    ) {
      return null;
    }
    return {
      type: parsed.type,
      title: parsed.title,
      orientation: parsed.orientation === "horizontal" ? "horizontal" : "vertical",
      labels: parsed.labels.map(String),
      values: parsed.values.map(Number),
      xLabel: parsed.xLabel,
      yLabel: parsed.yLabel,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SVG generation (Speetch aesthetic — monochrome, hairline grid, no shadows)
// ---------------------------------------------------------------------------

const W = 800;
const H = 460;
const M = { top: 56, right: 40, bottom: 80, left: 80 };
const INNER_W = W - M.left - M.right;
const INNER_H = H - M.top - M.bottom;
const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function niceCeil(value: number): number {
  if (value === 0) return 1;
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const mag = Math.pow(10, exp);
  const norm = abs / mag;
  let rounded: number;
  if (norm <= 1) rounded = 1;
  else if (norm <= 2) rounded = 2;
  else if (norm <= 2.5) rounded = 2.5;
  else if (norm <= 5) rounded = 5;
  else rounded = 10;
  return Math.sign(value) * rounded * mag;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function generateChartSvg(config: ChartConfig): string {
  if (config.type === "bar") {
    return config.orientation === "horizontal"
      ? generateHorizontalBarSvg(config)
      : generateVerticalBarSvg(config);
  }
  // jamais atteint en v1 mais TS strict
  return "";
}

function generateVerticalBarSvg(config: ChartConfig): string {
  const { labels, values, title, yLabel } = config;
  const max = niceCeil(Math.max(0, ...values));
  const min = Math.min(0, ...values);
  const min0 = min < 0 ? niceCeil(min) : 0;
  const range = max - min0 || 1;

  const n = labels.length;
  const slotW = INNER_W / n;
  const barW = Math.min(slotW * 0.62, 60);

  const yScale = (v: number): number => {
    return M.top + INNER_H - ((v - min0) / range) * INNER_H;
  };
  const zeroY = yScale(0);

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) =>
    min0 + (range * i) / ticks,
  );

  const titleEl = title
    ? `<text x="${W / 2}" y="${M.top - 28}" text-anchor="middle" font-family="${FONT_SANS}" font-size="20" font-weight="300" fill="#111" letter-spacing="-0.01em">${escapeXml(title)}</text>`
    : "";

  const yAxisLabel = yLabel
    ? `<text x="${-INNER_H / 2 - M.top}" y="${M.left - 56}" transform="rotate(-90)" text-anchor="middle" font-family="${FONT_MONO}" font-size="10" letter-spacing="0.2em" text-transform="uppercase" fill="#888">${escapeXml(yLabel.toUpperCase())}</text>`
    : "";

  const gridLines = tickValues
    .map((v) => {
      const y = yScale(v);
      return `<line x1="${M.left}" x2="${M.left + INNER_W}" y1="${y}" y2="${y}" stroke="#e5e0d8" stroke-width="1"/>
<text x="${M.left - 12}" y="${y + 4}" text-anchor="end" font-family="${FONT_MONO}" font-size="10" fill="#888">${formatNumber(v)}</text>`;
    })
    .join("\n");

  const bars = values
    .map((v, i) => {
      const x = M.left + i * slotW + (slotW - barW) / 2;
      const top = yScale(Math.max(v, 0));
      const bot = yScale(Math.min(v, 0));
      const height = Math.max(1, bot - top);
      return `<rect x="${x}" y="${top}" width="${barW}" height="${height}" fill="#1a1a1a"/>`;
    })
    .join("\n");

  const barLabels = values
    .map((v, i) => {
      const x = M.left + i * slotW + slotW / 2;
      const y = yScale(Math.max(v, 0)) - 8;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT_SANS}" font-size="11" font-weight="400" fill="#1a1a1a">${formatNumber(v)}</text>`;
    })
    .join("\n");

  const xLabels = labels
    .map((l, i) => {
      const x = M.left + i * slotW + slotW / 2;
      const y = M.top + INNER_H + 22;
      const shouldRotate = labels.some((lbl) => lbl.length > 8) || n > 8;
      const truncated = l.length > 18 ? l.slice(0, 17) + "…" : l;
      if (shouldRotate) {
        return `<text x="${x}" y="${y}" text-anchor="end" transform="rotate(-30 ${x} ${y})" font-family="${FONT_SANS}" font-size="11" fill="#444">${escapeXml(truncated)}</text>`;
      }
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT_SANS}" font-size="11" fill="#444">${escapeXml(truncated)}</text>`;
    })
    .join("\n");

  const baseLine = `<line x1="${M.left}" x2="${M.left + INNER_W}" y1="${zeroY}" y2="${zeroY}" stroke="#1a1a1a" stroke-width="1.5"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title ?? "Bar chart")}">
${titleEl}
${gridLines}
${baseLine}
${bars}
${barLabels}
${xLabels}
${yAxisLabel}
</svg>`;
}

function generateHorizontalBarSvg(config: ChartConfig): string {
  const { labels, values, title, yLabel } = config;
  const max = niceCeil(Math.max(0, ...values));
  const min = Math.min(0, ...values);
  const min0 = min < 0 ? niceCeil(min) : 0;
  const range = max - min0 || 1;

  const n = labels.length;
  const slotH = INNER_H / n;
  const barH = Math.min(slotH * 0.62, 44);

  const xScale = (v: number): number => {
    return M.left + ((v - min0) / range) * INNER_W;
  };
  const zeroX = xScale(0);

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) =>
    min0 + (range * i) / ticks,
  );

  const titleEl = title
    ? `<text x="${W / 2}" y="${M.top - 28}" text-anchor="middle" font-family="${FONT_SANS}" font-size="20" font-weight="300" fill="#111" letter-spacing="-0.01em">${escapeXml(title)}</text>`
    : "";

  const xAxisLabel = yLabel
    ? `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-family="${FONT_MONO}" font-size="10" letter-spacing="0.2em" text-transform="uppercase" fill="#888">${escapeXml(yLabel.toUpperCase())}</text>`
    : "";

  const gridLines = tickValues
    .map((v) => {
      const x = xScale(v);
      return `<line x1="${x}" x2="${x}" y1="${M.top}" y2="${M.top + INNER_H}" stroke="#e5e0d8" stroke-width="1"/>
<text x="${x}" y="${M.top + INNER_H + 18}" text-anchor="middle" font-family="${FONT_MONO}" font-size="10" fill="#888">${formatNumber(v)}</text>`;
    })
    .join("\n");

  const bars = values
    .map((v, i) => {
      const y = M.top + i * slotH + (slotH - barH) / 2;
      const left = xScale(Math.min(v, 0));
      const right = xScale(Math.max(v, 0));
      const width = Math.max(1, right - left);
      return `<rect x="${left}" y="${y}" width="${width}" height="${barH}" fill="#1a1a1a"/>`;
    })
    .join("\n");

  const valueLabels = values
    .map((v, i) => {
      const y = M.top + i * slotH + slotH / 2 + 4;
      const x = xScale(Math.max(v, 0)) + 8;
      return `<text x="${x}" y="${y}" font-family="${FONT_SANS}" font-size="11" font-weight="400" fill="#1a1a1a">${formatNumber(v)}</text>`;
    })
    .join("\n");

  const yLabels = labels
    .map((l, i) => {
      const y = M.top + i * slotH + slotH / 2 + 4;
      const truncated = l.length > 22 ? l.slice(0, 21) + "…" : l;
      return `<text x="${M.left - 12}" y="${y}" text-anchor="end" font-family="${FONT_SANS}" font-size="11" fill="#444">${escapeXml(truncated)}</text>`;
    })
    .join("\n");

  const baseLine = `<line x1="${zeroX}" x2="${zeroX}" y1="${M.top}" y2="${M.top + INNER_H}" stroke="#1a1a1a" stroke-width="1.5"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title ?? "Bar chart")}">
${titleEl}
${gridLines}
${baseLine}
${bars}
${valueLabels}
${yLabels}
${xAxisLabel}
</svg>`;
}

export const CHART_FIGURE_ATTR = CHART_MARKER_ATTR;
