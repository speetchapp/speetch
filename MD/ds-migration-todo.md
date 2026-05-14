# Design System — travail restant

> État : migration en cours
> Vue documentaire : `/admin/settings/design-system`
> Source des composants : `lib/ds/`

## ✅ Acquis

### Primitives extraites (11)

| Composant | Fichier | Variants / Props clés |
|---|---|---|
| `<Button>` | `lib/ds/button.tsx` | primary · large · ghost · danger · return · `href`/`pending` |
| `<Hairline>` | `lib/ds/hairline.tsx` | width sm/md/lg/xl · hover sm/md/lg/xl |
| `<Eyebrow>` | `lib/ds/eyebrow.tsx` | tracking sm/md/lg · intensity muted/default/strong · `as` |
| `<Sceau>` | `lib/ds/sceau.tsx` | size sm/md/lg/xl · variant default/strong/muted/inverse |
| `<Snippet>` | `lib/ds/snippet.tsx` | bloc `<pre>` mono 11px |
| `<Kbd>` / `<KbdCombo>` | `lib/ds/kbd.tsx` | touches clavier + combo avec séparateur |
| `<Field>` | `lib/ds/field.tsx` | label + hint + input wrapper |
| `<StatusBadge>` | `lib/ds/status-badge.tsx` | tone success/warning/danger/neutral/info · pulsing |
| `<Chip>` | `lib/ds/chip.tsx` | tone default/muted/warning/success/danger/info |
| `<Modal>` / `<ModalHeader>` | `lib/ds/modal.tsx` | backdrop + Esc + click-out + framer-motion + header title/subtitle/actions/close |

### Tokens centralisés

`app/globals.css` :
- Couleurs : `--color-bg`, `--color-fg`, `--color-tech`, `--color-muted`
- Sémantiques : `--color-success`, `--color-warning`, `--color-danger`
- Hairlines : `--color-hair-strong`, `--color-hair-default`, `--color-hair-muted`
- Surfaces : `--color-surface`, `--color-surface-hover`
- Easings : `--ease-out-expo`, `--ease-in-out-quart`
- Durations : `--duration-color`, `--duration-hairline`, `--duration-reveal`

`tailwind.config.ts` (déjà en place) :
- `easeOutExpo` `[0.22, 1, 0.36, 1]`
- `transitionDuration` 400 / 600 / 800 / 1200
- Keyframes `marquee`, `ping-soft`, `fade-in/up/down`, `reveal`

### Fichiers migrés (21)

**Admin chrome**
- `app/admin/_components/admin-sidebar.tsx`
- `app/admin/page.tsx` (dashboard)
- `app/admin/settings/page.tsx`
- `app/admin/settings/design-system/page.tsx` (Field, Snippet, Kbd extraits)

**Admin listes**
- `app/admin/clients/page.tsx`
- `app/admin/templates/page.tsx`
- `app/admin/clients/[id]/projects/[projectId]/page.tsx`

**Admin formulaires**
- `app/admin/settings/profile/profile-form.tsx`
- `app/admin/templates/new/upload-form.tsx`
- `app/admin/templates/[id]/edit-form.tsx`
- `app/admin/clients/[id]/projects/[projectId]/pages/new/new-page-form.tsx`
- `app/admin/clients/[id]/projects/[projectId]/pages/new/new-raw-html-page-form.tsx`

**Admin éditeur de page** (vague 4)
- `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/page-editor.tsx`
- `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/_raw/raw-html-page-editor.tsx`
- `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/_raw/media-library-modal.tsx`

**Admin création** (vague 4)
- `app/admin/clients/new/new-client-form.tsx`
- `app/admin/clients/[id]/projects/new/new-project-form.tsx`
- `app/admin/clients/[id]/projects/new/type-picker.tsx`

**Vues publiques**
- `app/clients/[slug]/[projectSlug]/[pageSlug]/fwa-page-view.tsx`
- `app/clients/[slug]/[projectSlug]/[pageSlug]/document-page-view.tsx`
- `app/clients/[slug]/[projectSlug]/[pageSlug]/public-page-view.tsx`
- `app/clients/[slug]/[projectSlug]/[pageSlug]/raw-html-page-view.tsx`

---

## 🚧 Reste à faire

### A. Primitives à extraire (priorité d'usage)

**Priorité haute** — pattern dupliqué ≥ 3 fois dans l'app

- [x] `<Modal>` + `<ModalHeader>` · header + backdrop + Esc/click-out + framer-motion (cf. `MediaLibraryModal` ✅)
- [ ] `<Hero variant="monumental|standard|split|kpi">` · les 7 patterns de § 54
- [ ] `<Chapter num title>` · le pattern FWA Grade (FwaPageView)
- [ ] `<Card>` avec sous-composants (`<Card.Cover>`, `<Card.Body>`, `<Card.Footer>`) · cf. § 55
- [ ] `<Callout tone="info|warning|success|danger">` + body italique (§ 40)
- [ ] `<Tabs role="tablist">` + `<Tab role="tab">` (segmented, pill, underline) · cf. § 49
- [ ] `<EmptyState description action>` · pattern admin/empty récurrent
- [ ] `<Avatar>` (cercle avec image ou initiale, différent du Sceau)

**Priorité moyenne** — patterns moins fréquents mais utiles

- [ ] `<DropZone>` · file upload (cf. design-system + `upload-zone.tsx`)
- [ ] `<DragHandle>` · 6-dots ou 3-bars
- [ ] `<Toast>` · sticky bottom with auto-dismiss
- [ ] `<Banner>` · sticky top (cookies, maintenance, beta…)
- [ ] `<Tooltip>` · hover + focus-visible + role="tooltip"
- [ ] `<Stepper>` (segmented + labellisé)
- [ ] `<Pagination>` (numérique + prev/next)
- [ ] `<Divider variant="hairline|gradient|sceau|glyph">`
- [ ] `<Stats>` · KPI grid (label + valeur + delta)
- [ ] `<Marquee>` · ribbon animé

**Priorité basse** — éditoriaux / patterns spécifiques

- [ ] `<PullQuote variant author>` (§ 41)
- [ ] `<DropCap>` (§ 42)
- [ ] `<Timeline>` + `<TimelineItem>` (§ 45)
- [ ] `<NumberedStep>` (§ 44)
- [ ] `<Sommaire>` (extrait depuis design-system/page.tsx)
- [ ] `<Block>` (idem)
- [ ] `<SearchInput shortcut>` (§ 34)
- [ ] `<Spinner>` / `<Loader>` décoratif counter (§ 17 / § 35)

### B. Fichiers à migrer

**Public (priorité haute)**
- [ ] `app/page.tsx` (Coming Soon)
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/clients/[slug]/page.tsx`
- [ ] `app/clients/[slug]/client-space-view.tsx`
- [ ] `app/clients/[slug]/unlock-gate.tsx`

**Admin éditeur de page** (cœur du back-office)
- [x] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/page-editor.tsx` ✅
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/section-editor.tsx`
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/media-uploader.tsx`
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/autosave-input.tsx`
- [x] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/_raw/raw-html-page-editor.tsx` ✅
- [x] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/_raw/media-library-modal.tsx` ✅
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/[pageId]/_raw/directions-editor.tsx`

**Admin création**
- [ ] `app/admin/clients/new/page.tsx`
- [x] `app/admin/clients/new/new-client-form.tsx` ✅
- [ ] `app/admin/clients/[id]/projects/new/page.tsx`
- [x] `app/admin/clients/[id]/projects/new/new-project-form.tsx` ✅
- [x] `app/admin/clients/[id]/projects/new/type-picker.tsx` ✅
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/new/page.tsx`
- [ ] `app/admin/clients/[id]/projects/[projectId]/pages/new/template-picker.tsx`
- [ ] `app/admin/templates/new/page.tsx`
- [ ] `app/admin/templates/[id]/page.tsx`

**Admin divers**
- [ ] `app/admin/clients/[id]/design/page.tsx`
- [ ] `app/admin/clients/[id]/design/upload-zone.tsx`
- [ ] `app/admin/settings/profile/page.tsx`
- [ ] `app/admin/templates/delete-button.tsx`
- [ ] `app/admin/clients/[id]/projects/[projectId]/_components/detach-page-button.tsx`

**Design system page elle-même** (le plus dense)
- [ ] `app/admin/settings/design-system/page.tsx` — 14K lignes, sections à migrer pour que les previews importent les vrais composants :
  - § 05 Composants (buttons / cards / hairlines) → `<Button>` / `<Hairline>`
  - § 07 Badges → `<StatusBadge>` / `<Chip>`
  - § 39 Logo & brand → `<Sceau>` partout
  - § 50 Section dividers → `<Hairline>` variantes
  - § 52 Boutons → `<Button>` partout

### C. Documentation page (DS = source de vérité)

- [ ] Chaque preview de la page DS doit importer le vrai composant depuis `@/lib/ds`
- [ ] Supprimer les copies inline qui font doublon avec la prod
- [ ] Ajouter des entrées sommaire `Sommaire` (Block, Summary, Family headers) quand on les extraira

### D. Tokens à étendre

- [ ] Échelle typographique (sizes, line-heights, tracking) en CSS vars
- [ ] Z-index canonique en CSS vars (z-10 → z-120, cf. § 31)
- [ ] Border radius canonique (rounded-md / rounded-2xl / rounded-full)
- [ ] Plugin Tailwind si besoin (custom utilities `text-eyebrow`, `tracking-eyebrow`)

### E. Discipline / process

- [ ] Avant d'ajouter une UI dans un fichier : vérifier si elle existe déjà au DS. Sinon, l'ajouter d'abord à `lib/ds/`.
- [ ] Toute modification de design (palette, typo, mouvement) passe par les tokens CSS ou un composant DS — jamais en inline class dans un fichier feuille.
- [ ] Le bouton « Voir le composant » de la doc devrait pointer vers `lib/ds/<name>.tsx` (GitHub link ou similaire), à mettre en place quand le repo sera versionné.

### F. Vérifications continues

- [ ] `npx tsc --noEmit` après chaque vague de migration
- [ ] Smoke tests sur `/admin/*` et `/clients/club-abrazo*`
- [ ] Visual diff côté navigateur (au moins un screenshot de référence par page avant migration)

---

## 📊 Métriques

- **Composants DS** : 11 / ~30 cibles (~ 37 %)
- **Fichiers migrés** : 21 / ~40 fichiers Speetch (~ 53 %)
- **Tokens CSS** : ~12 vars consolidées
- **Sections de doc** : 56 / 56 documentées (100 %), 7 réellement consommatrices de la lib

## 📅 Plan de progression suggéré

**Vague 4 ✅** : extraction `<Modal>` + migration page-editor + raw-html-page-editor + media-library-modal + new-client-form + new-project-form + type-picker

**Vague 5 (prochaine)** : `<Hero>` + `<Chapter>` + `<Callout>` + migration des pages publiques restantes (page.tsx, login, clients/[slug]/page.tsx, client-space-view, unlock-gate) + admin pages restantes (template-picker, templates/[id]/page.tsx, design/page.tsx + upload-zone)

**Vague 6** : `<Card>` + composants éditoriaux (PullQuote, DropCap, Timeline, NumberedStep) + sections DS qui les utilisent réellement

**Vague 7** : extension tokens (typo scale, z-index, radius) + cleanup final + Storybook-like preview du DS
