/**
 * Script injecté dans le srcDoc des viewers raw_html pour permettre aux
 * clients de surligner du texte dans la page.
 *
 * Protocole postMessage (bidirectionnel parent ↔ iframe) :
 *
 *  iframe → parent
 *    { type: "speetch-annot-ready" }                                    // au load
 *    { type: "speetch-annot-selection", exact, prefix, suffix, x, y }   // mouseup sur sélection
 *    { type: "speetch-annot-click", id, color, x, y }                   // clic sur un highlight
 *
 *  parent → iframe
 *    { type: "speetch-annot-apply", annotations: [{ id, color, anchor_exact, anchor_prefix, anchor_suffix }] }
 *
 * L'algo d'ancrage suit le W3C text-quote selector :
 *  - on cherche `prefix + exact + suffix` dans le textContent global du <body>
 *  - on prend le 1er match (les contextes 64 chars suffisent à disambiguer)
 *  - on reconstruit la Range puis on wrappe les portions de text-nodes
 *    avec un <mark class="speetch-annotation">
 *
 * Le wrap fonctionne même quand la sélection traverse plusieurs nœuds
 * (paragraphes, balises imbriquées) — on split chaque text node touché et
 * on ne wrappe que la portion concernée.
 */

const ANNOT_CSS = `
mark.speetch-annotation {
  padding: 0 1px;
  border-radius: 1px;
  cursor: pointer;
  color: inherit;
  text-decoration: inherit;
  background-image: none;
  transition: filter 120ms ease-out;
}
mark.speetch-annotation:hover { filter: brightness(0.92); }
mark.speetch-annotation[data-color="yellow"] { background-color: #fef08a; }
mark.speetch-annotation[data-color="green"]  { background-color: #bbf7d0; }
mark.speetch-annotation[data-color="pink"]   { background-color: #fbcfe8; }
mark.speetch-annotation[data-color="blue"]   { background-color: #bfdbfe; }
`;

const SCRIPT_BODY = `
(function() {
  var MARK_TAG = 'MARK';
  var MARK_CLASS = 'speetch-annotation';
  var current = [];

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TITLE' || tag === 'NOSCRIPT';
  }

  // Récupère tous les text nodes utiles + leur offset cumulé dans le body
  function collectTextNodes() {
    var body = document.body;
    if (!body) return { nodes: [], starts: [], full: '' };
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n) {
        var p = n.parentNode;
        while (p) {
          if (p.nodeType === 1 && isSkippable(p)) return NodeFilter.FILTER_REJECT;
          if (p === body) break;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var starts = [];
    var pos = 0;
    var n;
    var pieces = [];
    while ((n = walker.nextNode())) {
      var v = n.nodeValue || '';
      nodes.push(n);
      starts.push(pos);
      pieces.push(v);
      pos += v.length;
    }
    return { nodes: nodes, starts: starts, full: pieces.join('') };
  }

  // Trouve un text-quote dans le textContent global. Renvoie [start, end] (en
  // chars dans full) ou null. Si prefix/suffix sont vides ou ne matchent pas,
  // fallback sur la première occurrence d'exact.
  function findRange(full, exact, prefix, suffix) {
    if (!exact) return null;
    if (prefix || suffix) {
      var idx = full.indexOf(prefix + exact + suffix);
      if (idx >= 0) {
        var start = idx + prefix.length;
        return [start, start + exact.length];
      }
    }
    var s = full.indexOf(exact);
    if (s < 0) return null;
    return [s, s + exact.length];
  }

  // Wrappe la portion [startOffset, endOffset] (global) dans des <mark>.
  function wrapPortion(startOffset, endOffset, id, color) {
    if (endOffset <= startOffset) return;
    var info = collectTextNodes();
    var nodes = info.nodes;
    var starts = info.starts;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var nStart = starts[i];
      var nEnd = nStart + (node.nodeValue || '').length;
      if (nEnd <= startOffset) continue;
      if (nStart >= endOffset) break;
      var localStart = Math.max(0, startOffset - nStart);
      var localEnd = Math.min(node.nodeValue.length, endOffset - nStart);
      if (localEnd <= localStart) continue;
      // Split: avant + sélection + après
      var middle = node;
      if (localStart > 0) middle = middle.splitText(localStart);
      // middle commence à localStart. Couper après (localEnd - localStart) chars.
      var sliceLen = localEnd - localStart;
      if (middle.nodeValue.length > sliceLen) {
        middle.splitText(sliceLen);
      }
      // Wrap middle dans un <mark>
      var mark = document.createElement('mark');
      mark.className = MARK_CLASS;
      mark.setAttribute('data-speetch-id', id);
      mark.setAttribute('data-color', color);
      var parent = middle.parentNode;
      if (parent) {
        parent.insertBefore(mark, middle);
        mark.appendChild(middle);
      }
    }
  }

  function unwrapAll() {
    var marks = document.querySelectorAll('mark.' + MARK_CLASS);
    Array.prototype.forEach.call(marks, function(m) {
      var parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      // Normalise pour fusionner les text nodes adjacents (évite des splits orphelins)
      if (parent.normalize) parent.normalize();
    });
  }

  function applyAll(list) {
    unwrapAll();
    current = list || [];
    if (current.length === 0) return;
    var info = collectTextNodes();
    for (var i = 0; i < current.length; i++) {
      var a = current[i];
      var found = findRange(info.full, a.anchor_exact || '', a.anchor_prefix || '', a.anchor_suffix || '');
      if (!found) continue;
      wrapPortion(found[0], found[1], a.id, a.color);
    }
  }

  function emit(type, payload) {
    try {
      var msg = Object.assign({ type: type }, payload || {});
      parent.postMessage(msg, '*');
    } catch (e) {}
  }

  function onMouseUp(e) {
    // Ignore clic sur un highlight existant (géré séparément)
    var node = e.target;
    while (node && node.nodeType === 1) {
      if (node.tagName === MARK_TAG && node.classList.contains(MARK_CLASS)) return;
      node = node.parentNode;
    }
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    var text = sel.toString();
    if (!text || !text.trim()) return;

    // Construit le prefix/suffix à partir du textContent global du body
    var info = collectTextNodes();
    var full = info.full;
    var exact = text;
    // Recherche la position de la sélection dans le textContent
    // On reconstitue le start global via la range
    var range = sel.getRangeAt(0);
    var startNode = range.startContainer;
    var startOffset = range.startOffset;
    // Si startNode n'est pas un text node, on prend childNodes[startOffset]
    if (startNode.nodeType !== 3) {
      var child = startNode.childNodes[startOffset];
      if (child && child.nodeType === 3) {
        startNode = child;
        startOffset = 0;
      } else {
        return;
      }
    }
    var globalStart = -1;
    for (var i = 0; i < info.nodes.length; i++) {
      if (info.nodes[i] === startNode) {
        globalStart = info.starts[i] + startOffset;
        break;
      }
    }
    if (globalStart < 0) return;

    var prefix = full.slice(Math.max(0, globalStart - 64), globalStart);
    var suffix = full.slice(globalStart + exact.length, globalStart + exact.length + 64);

    emit('speetch-annot-selection', {
      exact: exact,
      prefix: prefix,
      suffix: suffix,
      x: e.clientX,
      y: e.clientY,
    });
  }

  function onClick(e) {
    var node = e.target;
    while (node && node.nodeType === 1) {
      if (node.tagName === MARK_TAG && node.classList.contains(MARK_CLASS)) {
        e.preventDefault();
        e.stopPropagation();
        emit('speetch-annot-click', {
          id: node.getAttribute('data-speetch-id'),
          color: node.getAttribute('data-color'),
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }
      node = node.parentNode;
    }
  }

  function onMessage(e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'speetch-annot-apply') {
      applyAll(d.annotations || []);
    }
  }

  function bootstrap() {
    try {
      document.addEventListener('mouseup', onMouseUp, true);
      document.addEventListener('click', onClick, true);
      window.addEventListener('message', onMessage);
      emit('speetch-annot-ready', {});
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
`;

/**
 * Renvoie le `<style>` + `<script>` à injecter dans le srcDoc juste avant
 * </body> pour activer les annotations dans l'iframe.
 */
export function buildAnnotationsInjection(): string {
  const escapedCss = ANNOT_CSS.replace(/<\/style/gi, "<\\/style");
  const escapedJs = SCRIPT_BODY.replace(/<\/script/gi, "<\\/script");
  return `
<style data-speetch-annotations="true">${escapedCss}</style>
<script data-speetch-annotations="true">${escapedJs}</script>`;
}

export function injectAnnotationsBundle(html: string): string {
  const inject = buildAnnotationsInjection();
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx >= 0) {
    return html.slice(0, idx) + inject + html.slice(idx);
  }
  return html + inject;
}
