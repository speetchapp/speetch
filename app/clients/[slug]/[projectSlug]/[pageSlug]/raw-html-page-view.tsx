"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Hairline } from "@/lib/ds";

/**
 * Rendu "raw HTML" — utilisé pour les pages dont content.meta.style = "raw_html".
 * Le HTML d'origine est injecté tel quel dans un iframe sandbox, ce qui
 * préserve 100% de la mise en page (styles inline, tables, grilles, JS UI…).
 *
 * Sandbox : `allow-scripts allow-same-origin`. Le JS est nécessaire pour les
 * UIs interactives (onglets, accordéons, animations) typiques des documents
 * uploadés. La combinaison `scripts + same-origin` est ≈ équivalente à pas
 * de sandbox côté spec : c'est assumé car SEUL l'owner uploade du HTML, et
 * il fait confiance à son propre contenu. Le client final (qui visualise) ne
 * peut pas injecter de HTML. On garde le sandbox pour bloquer la navigation
 * top-level et les form submits.
 *
 * Auto-hauteur : on observe `document.body.scrollHeight` via un MutationObserver
 * dans l'iframe (injecté en post-load) puis on remonte la hauteur au parent
 * pour que l'iframe ne génère pas de scroll interne. Tombe en fallback sur
 * une hauteur min de 80vh si la mesure échoue.
 */
export function RawHtmlPageView({
  clientSlug,
  clientName,
  projectName,
  pageName,
  rawHtml,
  textOverrides,
  imageOverrides,
}: {
  clientSlug: string;
  clientName: string;
  projectName: string;
  pageName: string;
  rawHtml: string;
  textOverrides?: Record<string, string>;
  imageOverrides?: Record<string, string>;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(0);

  // HTML enrichi du script de substitution si des overrides existent.
  const srcDoc = useMemo(
    () => injectOverridesScript(rawHtml, textOverrides, imageOverrides),
    [rawHtml, textOverrides, imageOverrides],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function measure() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const body = doc.body;
        const html = doc.documentElement;
        const next = Math.max(
          body?.scrollHeight ?? 0,
          body?.offsetHeight ?? 0,
          html?.scrollHeight ?? 0,
          html?.offsetHeight ?? 0,
        );
        if (next > 0) {
          setHeight(next);
        }
      } catch {
        // Cross-origin guard — ne devrait pas arriver avec allow-same-origin
        // sur srcDoc, mais on capture par sécurité.
      }
    }

    function onLoad() {
      measure();
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const observer = new MutationObserver(() => measure());
        observer.observe(doc.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        // Quelques re-mesures espacées pour rattraper le chargement async
        // (fonts Google, images).
        const timers: number[] = [
          window.setTimeout(measure, 250),
          window.setTimeout(measure, 750),
          window.setTimeout(measure, 1500),
          window.setTimeout(measure, 3000),
        ];

        // Cleanup au cas où le composant unmount
        iframe.addEventListener(
          "beforeunload",
          () => {
            observer.disconnect();
            timers.forEach((t) => window.clearTimeout(t));
          },
          { once: true },
        );
      } catch {
        // ignore
      }
    }

    iframe.addEventListener("load", onLoad);
    // Si l'iframe est déjà chargé (srcDoc sync), force un measure
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }

    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, []);

  return (
    <div className="relative min-h-svh w-full bg-[#0a0a0a]">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-white/5 bg-black/65 px-6 py-5 backdrop-blur-md md:px-12">
        <Link
          href={`/clients/${clientSlug}`}
          className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors hover:text-white"
        >
          <Hairline width="md" hover="lg" />
          <span>{clientName}</span>
        </Link>
        <span className="hidden text-[11px] uppercase tracking-[0.28em] text-white/40 md:inline">
          {projectName}
          <span className="mx-3 text-white/20">·</span>
          {pageName}
        </span>
        <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">
          Reproduction fidèle
        </span>
      </header>

      {/* Document */}
      <div className="w-full">
        <iframe
          ref={iframeRef}
          title={pageName}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          style={{
            width: "100%",
            height: height > 0 ? `${height}px` : "80vh",
            border: "none",
            background: "white",
            display: "block",
          }}
        />
      </div>

      {/* Footer */}
      <footer className="flex items-end justify-between border-t border-white/5 bg-black px-6 py-8 text-[11px] uppercase tracking-[0.28em] text-white/40 md:px-12">
        <span>Paris · 2026</span>
        <span>Speetch · Confidentiel</span>
      </footer>
    </div>
  );
}

/**
 * Injecte un <script> avant </body> qui applique les overrides texte/image
 * au DOMContentLoaded de l'iframe. Si aucun override n'est défini, renvoie
 * le HTML tel quel.
 *
 * Sécurité : on encode les maps via JSON.stringify + escape de </script.
 * Le script tourne dans l'iframe, qui a `allow-scripts allow-same-origin`.
 */
function injectOverridesScript(
  html: string,
  textOverrides: Record<string, string> | undefined,
  imageOverrides: Record<string, string> | undefined,
): string {
  const texts = textOverrides ?? {};
  const images = imageOverrides ?? {};
  if (Object.keys(texts).length === 0 && Object.keys(images).length === 0) {
    return html;
  }

  const escape = (obj: Record<string, string>) =>
    JSON.stringify(obj).replace(/<\/script/gi, "<\\/script");

  const script = `
<script>
(function() {
  try {
    var TEXTS = ${escape(texts)};
    var IMAGES = ${escape(images)};

    function applyTexts() {
      if (!Object.keys(TEXTS).length) return;
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          var p = node.parentNode;
          while (p) {
            if (p.nodeType === 1) {
              var t = p.tagName;
              if (t === 'SCRIPT' || t === 'STYLE' || t === 'TITLE') return NodeFilter.FILTER_REJECT;
            }
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function(node) {
        var raw = node.nodeValue || '';
        var trimmed = raw.trim();
        if (!trimmed) return;
        if (Object.prototype.hasOwnProperty.call(TEXTS, trimmed)) {
          var lead = (raw.match(/^\\s*/) || [''])[0];
          var trail = (raw.match(/\\s*$/) || [''])[0];
          node.nodeValue = lead + TEXTS[trimmed] + trail;
        }
      });
    }

    function applyImages() {
      if (!Object.keys(IMAGES).length) return;
      var imgs = document.querySelectorAll('img');
      Array.prototype.forEach.call(imgs, function(img) {
        var src = img.getAttribute('src');
        if (src && Object.prototype.hasOwnProperty.call(IMAGES, src)) {
          img.setAttribute('src', IMAGES[src]);
          // Recharge srcset si présent (sinon le browser garde l'ancienne)
          if (img.hasAttribute('srcset')) img.removeAttribute('srcset');
        }
      });
    }

    function run() {
      applyTexts();
      applyImages();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  } catch (e) {
    console.error('[speetch-overrides] error:', e);
  }
})();
</script>`;

  // Injecte avant </body> (ou en fin si pas trouvé)
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx >= 0) {
    return html.slice(0, idx) + script + html.slice(idx);
  }
  return html + script;
}
