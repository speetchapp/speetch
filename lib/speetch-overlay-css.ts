/**
 * Feuille de style "Speetch overlay" — injectée dans l'iframe d'une note
 * de contexte raw_html quand le flag `meta.apply_speetch_ds` est ON.
 *
 * Inspirée du DS admin Speetch :
 *  - Fond noir profond + texte #F5F5F7
 *  - Sans-serif Inter en weight 200/300
 *  - Italiques en Cormorant Garamond
 *  - Hairlines subtils, max-width confortable
 *
 * STRATÉGIE — reset universel agressif puis ré-établissement ciblé :
 * 1. * + ::before + ::after → reset background, color (inherit), border-color,
 *    box-shadow, et background-image. Indispensable pour outre-passer les
 *    HTML chargés avec classes custom (.doc, .eyebrow, .container, etc.)
 *    qui peignent leurs propres backgrounds / couleurs.
 * 2. On RÉTABLIT ensuite background sur pre, code, th, blockquote (les seuls
 *    surfaces qui doivent ressortir).
 * 3. Couleurs : body fixe #F5F5F7, tout le reste hérite (color: inherit).
 *    Spécifiques pour em, code, figcaption, etc.
 */
export const SPEETCH_OVERLAY_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400&family=Cormorant+Garamond:ital,wght@0,400;1,400&display=swap');

/* ============ RESET UNIVERSEL ============ */
*, *::before, *::after {
  background-color: transparent !important;
  background-image: none !important;
  border-color: rgba(245, 245, 247, 0.1) !important;
  box-shadow: none !important;
  outline-color: rgba(245, 245, 247, 0.2) !important;
  color: inherit !important;
}

/* ============ BASE ============ */
html {
  background: #0a0a0a !important;
}

body {
  background: #0a0a0a !important;
  color: #F5F5F7 !important;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif !important;
  font-weight: 300 !important;
  font-size: 1rem !important;
  line-height: 1.75 !important;
  max-width: 760px !important;
  margin: 0 auto !important;
  padding: 5rem 2rem 6rem !important;
}

/* ============ TITRES ============ */
h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', ui-sans-serif, sans-serif !important;
  font-weight: 200 !important;
  font-style: normal !important;
  letter-spacing: -0.03em !important;
  color: #F5F5F7 !important;
  margin: 2.5rem 0 1rem !important;
  line-height: 1.1 !important;
  text-align: left !important;
}
h1 { font-size: clamp(2.25rem, 5.5vw, 3.5rem) !important; margin-top: 0 !important; }
h2 { font-size: clamp(1.5rem, 3vw, 2rem) !important; }
h3 { font-size: 1.4rem !important; }
h4 { font-size: 1.15rem !important; }

/* ============ TEXTE ============ */
p, span, div, li, td, th, dt, dd, label, address {
  color: rgba(245, 245, 247, 0.8) !important;
  font-family: inherit !important;
  text-align: left !important;
}

p {
  margin: 0 0 1rem !important;
}

em, i {
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif !important;
  font-style: italic !important;
  font-weight: 400 !important;
  color: rgba(245, 245, 247, 0.95) !important;
  letter-spacing: 0.01em !important;
}

strong, b {
  font-weight: 500 !important;
  color: #F5F5F7 !important;
}

small {
  font-size: 0.85em !important;
  color: rgba(245, 245, 247, 0.55) !important;
}

a {
  color: #F5F5F7 !important;
  text-decoration: none !important;
  border-bottom: 1px solid rgba(245, 245, 247, 0.3) !important;
  transition: border-color 0.2s !important;
}
a:hover { border-bottom-color: #F5F5F7 !important; }

/* ============ CODE ============ */
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
  background-color: rgba(255, 255, 255, 0.07) !important;
  padding: 0.125rem 0.4rem !important;
  border-radius: 4px !important;
  font-size: 0.875em !important;
  color: #F5F5F7 !important;
}

pre {
  background-color: #000 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 10px !important;
  overflow-x: auto !important;
  margin: 1.75rem 0 !important;
  line-height: 1.55 !important;
  font-size: 0.85rem !important;
  color: #F5F5F7 !important;
}
pre code {
  background-color: transparent !important;
  padding: 0 !important;
  font-size: inherit !important;
  color: inherit !important;
}

/* ============ CITATIONS ============ */
blockquote {
  background-color: transparent !important;
  border-left: 2px solid rgba(245, 245, 247, 0.25) !important;
  padding: 0.25rem 0 0.25rem 1.5rem !important;
  margin: 1.75rem 0 !important;
  font-family: 'Cormorant Garamond', Georgia, serif !important;
  font-style: italic !important;
  font-size: 1.1em !important;
  color: rgba(245, 245, 247, 0.75) !important;
}

/* ============ LISTES ============ */
ul, ol {
  padding-left: 1.5rem !important;
  margin: 0 0 1rem !important;
  color: rgba(245, 245, 247, 0.8) !important;
}
li {
  margin: 0.4rem 0 !important;
}
ul li::marker {
  color: rgba(245, 245, 247, 0.35) !important;
}

hr {
  border: none !important;
  border-top: 1px solid rgba(245, 245, 247, 0.1) !important;
  margin: 3rem 0 !important;
}

/* ============ IMAGES ============ */
img, figure {
  max-width: 100% !important;
  height: auto !important;
}
figure {
  margin: 2rem 0 !important;
}
figcaption {
  font-family: 'Cormorant Garamond', Georgia, serif !important;
  font-style: italic !important;
  color: rgba(245, 245, 247, 0.55) !important;
  font-size: 0.9rem !important;
  margin-top: 0.5rem !important;
}

/* ============ TABLES ============ */
table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 1.75rem 0 !important;
  font-size: 0.95em !important;
  background-color: transparent !important;
}
th, td {
  border: 1px solid rgba(245, 245, 247, 0.08) !important;
  padding: 0.85rem 1rem !important;
  text-align: left !important;
}
th {
  background-color: rgba(255, 255, 255, 0.03) !important;
  font-weight: 400 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.18em !important;
  font-size: 0.78em !important;
  color: rgba(245, 245, 247, 0.55) !important;
}
td {
  color: rgba(245, 245, 247, 0.8) !important;
}

/* ============ SÉLECTION ============ */
::selection {
  background-color: rgba(245, 245, 247, 0.15) !important;
  color: #fff !important;
}

/* ============ DÉCORATIONS PSEUDO ============ */
/* Beaucoup de HTML d'origine utilisent ::before/::after pour des bordures
   décoratives ou des séparateurs typographiques (❦, traits bordeaux, etc.).
   On les neutralise pour garder une feuille blanche. */
*::before, *::after {
  content: none !important;
  background-image: none !important;
  border: none !important;
}

/* ============ FORMULAIRES ============ */
button, input, select, textarea {
  font-family: inherit !important;
  color: inherit !important;
}

/* ============ ANTI-OVERFLOW ============ */
* {
  max-width: 100% !important;
}
`;
