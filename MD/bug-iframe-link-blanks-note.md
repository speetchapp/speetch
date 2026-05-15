# Bug — Clic sur un lien dans une note rend l'iframe blanche

**Statut : non résolu** · ouvert le 2026-05-15 · à reprendre

## Symptôme

Dans le viewer admin d'une note de contexte en mode `raw_html`
(`/admin/clients/[id]/context/[contextId]`), cliquer sur n'importe
quel lien à l'intérieur de la note fait disparaître son contenu :
l'iframe affiche une page entièrement blanche (cf. screenshot du
2026-05-15 12:20 sur le Desktop). L'utilisateur perd son contexte
et doit revenir en arrière.

Reproduction confirmée sur la note **« prompts-ia-generation-images.md »**
(client Club Abrazo, importée depuis un fichier `.md`). Probable que
ça reproduise sur n'importe quelle note avec liens externes.

## Hypothèse retenue (probablement correcte)

Le `<a href>` cliqué navigue **l'iframe elle-même** vers la cible.
Comme la majorité des sites externes envoient `X-Frame-Options: DENY`
ou `Content-Security-Policy: frame-ancestors 'none'`, l'iframe se
retrouve avec un document vide → page blanche.

## Ce qui a été tenté (sans succès en local)

### Tentative 1 — `target="_blank"` + `allow-popups`
Commit `2e52ef8` :
- Script injecté à la fin du `<body>` qui itère sur tous les `<a[href]>`
  non-ancrés et leur ajoute `target="_blank"` + `rel="noopener noreferrer"`
- Sandbox iframe étendue avec `allow-popups allow-popups-to-escape-sandbox`

Résultat utilisateur : « ça ne marche toujours pas ».

### Tentative 2 — interception `click` + `postMessage` au parent
Commit `e1fb439` (déployé en dernier) :
- Script injecté qui ajoute un listener `click` en capture sur `document`,
  `preventDefault()`, puis `parent.postMessage({ type:'speetch-open-link',
  href }, '*')`
- Parent (composant React, hors sandbox) a un listener `message` qui
  appelle `window.open(href, '_blank', 'noopener,noreferrer')`

Résultat utilisateur en local : « ça ne marche toujours pas ».

> Le user a demandé de différer le debug. État au moment de la mise en
> pause : Tentative 2 déployée, **non vérifiée en prod** (uniquement
> testée en local côté user).

## Fichiers concernés

- `app/admin/clients/[id]/context/[contextId]/raw-html-context-view.tsx`
  - L. ~340-360 : `useEffect` parent qui écoute les `message` de l'iframe
  - L. ~948 : attribut `sandbox` de l'iframe
  - L. ~1339-1395 : `buildSrcDoc` + `injectExternalLinksScript`
  - L. ~512, ~629 : cleanup du script injecté avant sérialisation
    (`script[data-speetch-external-links]`)
- `app/clients/[slug]/[projectSlug]/[pageSlug]/raw-html-page-view.tsx`
  - Même logique (parent listener + script injecté) côté espace public
- Marqueur côté DOM iframe : `<script data-speetch-external-links="true">`

## Pistes à investiguer la prochaine fois

1. **Vérifier que le script est bien injecté dans l'iframe en local.**
   Ouvrir DevTools → sélectionner l'iframe (combo `cmd+shift+C` puis
   clic dedans, ou via le dropdown du panneau Elements) →
   `document.querySelector('script[data-speetch-external-links]')`.
   S'il est absent : le `useMemo` du srcDoc ne se rebuild pas, ou
   `injectExternalLinksScript` n'est pas appelé. Si présent : passer
   au point 2.

2. **Vérifier que le listener `click` est bien attaché.** Dans la
   console de l'iframe : `getEventListeners(document)` (Chrome) ou
   poser un `console.log` au début du listener.

3. **Vérifier que `preventDefault` est honoré.** Possible qu'un autre
   listener (du code interne de la note ?) fasse navigation
   programmatique (`window.location.href = ...`) avant ou après. Notre
   listener est en capture phase, donc il s'exécute en premier, mais
   `preventDefault` n'empêche pas `window.location = ...`.

4. **Vérifier que le `postMessage` arrive bien au parent.** Console
   parent : `window.addEventListener('message', e => console.log(e.data))`
   et reproduire le clic.

5. **Inspecter le HTML de la note.** Possible que le `.md` source
   contienne du HTML brut avec des liens custom (boutons, JS handlers
   inline `onclick="..."`). Marked ne strippe pas le HTML inline par
   défaut. Vérifier `client_contexts.content.meta.raw_html` en base
   pour la note incriminée.

6. **Tester en navigation privée.** Pour éliminer le cache iframe /
   service worker / extension navigateur.

7. **Si rien ne marche** : passer en mode brute-force — au lieu d'un
   `<iframe srcDoc>`, blob URL + sandbox sans `allow-same-origin` pour
   forcer cross-origin (les liens auraient alors un comportement strict
   target=\_top bloqué). Ou abandonner l'iframe pour les notes simples
   et rendre directement avec un `dangerouslySetInnerHTML` dans un
   shadow root.

## Comment reprendre

```bash
# 1. État actuel : la fix Tentative 2 (postMessage) est sur main
git log --oneline -5

# 2. Lancer le dev local et reproduire
npm run dev
# → ouvrir http://localhost:3000/admin/clients/<id>/context/<contextId>
# → cliquer un lien dans la note

# 3. Ouvrir DevTools, suivre les pistes ci-dessus dans l'ordre

# 4. Pour rollback les deux tentatives si on veut repartir propre :
#    git revert e1fb439 2e52ef8
#    (ou git reset --hard 0e687eb si on est sûr — destructif)
```

## Contexte technique utile

- Le viewer admin construit le `srcDoc` via `buildSrcDoc()` (l. ~1305)
  qui empile plusieurs injections : `injectHideStyles`,
  `injectSpeetchOverlay`, `injectOverridesScript`, et
  `injectExternalLinksScript`.
- Le composant a déjà 3 autres modes d'édition (`hide`, `text`,
  `chart`) qui injectent eux aussi des listeners click — vérifier
  qu'aucun conflit entre handlers (notre listener est en capture donc
  prioritaire, mais les autres modes ne sont actifs que lorsque
  `editMode !== "none"`).
- Le sandbox actuel : `allow-scripts allow-same-origin allow-popups
  allow-popups-to-escape-sandbox`. `allow-same-origin` permet au
  parent d'accéder au DOM de l'iframe (utilisé par hide/text/chart).
