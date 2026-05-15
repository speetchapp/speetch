"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  Field,
  Modal,
} from "@/lib/ds";
import {
  updateContextHiddenElements,
  updateContextRawHtml,
  updateContextTextOverrides,
} from "../actions";
import { SPEETCH_OVERLAY_CSS } from "@/lib/speetch-overlay-css";
import { SpeetchStyleButton } from "../_components/speetch-style-button";
import { AddBlockPanel } from "./add-block-panel";
import { ChartModal } from "./chart-modal";
import {
  CHART_FIGURE_ATTR,
  buildChartFigureHtml,
  parseChartFigure,
  parseTableElement,
  type ChartConfig,
} from "../_lib/chart";

/**
 * Viewer iframe sandbox pour les notes de contexte en mode "reproduction
 * fidèle". Trois modes utilisateur :
 *
 *  - "none"  : affichage simple (sandbox `allow-scripts allow-same-origin`)
 *  - "hide"  : click-to-hide. Le sélecteur CSS est calculé côté client. Une
 *              balise <style data-speetch-hide> est injectée dans le srcDoc
 *              avant </head> pour appliquer display:none.
 *  - "text"  : click-to-edit. Le click ouvre une Modal Speetch avec le texte
 *              original prérempli ; à la sauvegarde, on enregistre dans
 *              text_overrides (map "original" -> "custom"). Un <script> de
 *              substitution est injecté avant </body> pour appliquer les
 *              overrides à chaque load.
 *
 * Persistence : trois server actions distinctes pour chaque type de change
 * (hide list, text overrides, raw HTML après suppression physique).
 */
export function RawHtmlContextView({
  rawHtml,
  title,
  profileId,
  contextId,
  initialHiddenElements,
  initialTextOverrides,
  applySpeetchDs,
}: {
  rawHtml: string;
  title: string;
  profileId: string;
  contextId: string;
  initialHiddenElements: string[];
  initialTextOverrides: Record<string, string>;
  applySpeetchDs: boolean;
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(0);

  type EditMode = "none" | "hide" | "text" | "chart";
  const [editMode, setEditMode] = useState<EditMode>("none");

  // Cible courante du mode chart : un <table> existant pour créer un
  // graphique, OU un <figure data-speetch-chart> existant pour éditer.
  // Le ref direct n'est pas safe (peut être détaché après update du
  // raw_html) — on stocke un sélecteur CSS pour retrouver l'élément
  // après save + iframe reload.
  const [chartTarget, setChartTarget] = useState<{
    kind: "table" | "chart";
    selector: string;
    tableHeaders: string[];
    tableRows: string[][];
    initialConfig: ChartConfig | null;
  } | null>(null);

  const [hiddenElements, setHiddenElements] = useState<string[]>(
    initialHiddenElements,
  );
  const baselineHiddenRef = useRef<string[]>(initialHiddenElements);

  const [textOverrides, setTextOverrides] = useState<Record<string, string>>(
    initialTextOverrides,
  );
  const baselineTextRef = useRef<Record<string, string>>(initialTextOverrides);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [confirmHideOpen, setConfirmHideOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmTextOpen, setConfirmTextOpen] = useState(false);
  const [confirmHtmlOpen, setConfirmHtmlOpen] = useState(false);

  const [textEditTarget, setTextEditTarget] = useState<{
    original: string;
    current: string;
  } | null>(null);
  const [textEditValue, setTextEditValue] = useState("");

  const [htmlEditOpen, setHtmlEditOpen] = useState(false);
  const [htmlEditValue, setHtmlEditValue] = useState(rawHtml);

  const hideDiff = useMemo(() => {
    const baseSet = new Set(baselineHiddenRef.current);
    const nextSet = new Set(hiddenElements);
    const added = hiddenElements.filter((s) => !baseSet.has(s));
    const removed = baselineHiddenRef.current.filter((s) => !nextSet.has(s));
    return { added, removed };
  }, [hiddenElements]);
  const hideDirty = hideDiff.added.length > 0 || hideDiff.removed.length > 0;

  const textDiff = useMemo(() => {
    const baseEntries = baselineTextRef.current;
    const currEntries = textOverrides;
    const added: Array<[string, string]> = [];
    const removed: Array<[string, string]> = [];
    const changed: Array<[string, string, string]> = []; // [original, baseValue, newValue]
    for (const [k, v] of Object.entries(currEntries)) {
      if (!(k in baseEntries)) {
        added.push([k, v]);
      } else if (baseEntries[k] !== v) {
        changed.push([k, baseEntries[k], v]);
      }
    }
    for (const [k, v] of Object.entries(baseEntries)) {
      if (!(k in currEntries)) {
        removed.push([k, v]);
      }
    }
    return { added, removed, changed };
  }, [textOverrides]);
  const textDirty =
    textDiff.added.length > 0 ||
    textDiff.removed.length > 0 ||
    textDiff.changed.length > 0;

  const srcDoc = useMemo(
    () => buildSrcDoc(rawHtml, hiddenElements, textOverrides, applySpeetchDs),
    [rawHtml, hiddenElements, textOverrides, applySpeetchDs],
  );

  // Auto-hauteur
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
        if (next > 0) setHeight(next);
      } catch {
        /* cross-origin guard */
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
        const timers: number[] = [
          window.setTimeout(measure, 250),
          window.setTimeout(measure, 750),
          window.setTimeout(measure, 1500),
          window.setTimeout(measure, 3000),
        ];
        iframe.addEventListener(
          "beforeunload",
          () => {
            observer.disconnect();
            timers.forEach((t) => window.clearTimeout(t));
          },
          { once: true },
        );
      } catch {
        /* ignore */
      }
    }

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }
    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, []);

  // Mode "hide" : click pour masquer un bloc
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc || !iframeDoc.body) return;
    const doc: Document = iframeDoc;
    const docBody: HTMLElement = iframeDoc.body;

    if (editMode !== "hide") {
      cleanupHideOverlays(doc);
      return;
    }

    const styleEl = doc.createElement("style");
    styleEl.id = "__speetch-hide-style";
    styleEl.textContent = HIDE_STYLE_CSS;
    doc.head.appendChild(styleEl);

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === docBody || target === doc.documentElement) {
        return;
      }
      doc.querySelectorAll(".__speetch-hide-hover").forEach((el) =>
        el.classList.remove("__speetch-hide-hover"),
      );
      target.classList.add("__speetch-hide-hover");
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      target?.classList.remove("__speetch-hide-hover");
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement | null;
      if (!target || target === docBody || target === doc.documentElement) {
        return;
      }
      const selector = getCssPath(target);
      if (!selector) return;
      setHiddenElements((prev) => {
        if (prev.includes(selector)) {
          return prev.filter((s) => s !== selector);
        }
        return [...prev, selector];
      });
    };

    docBody.addEventListener("mouseover", onMouseOver, true);
    docBody.addEventListener("mouseout", onMouseOut, true);
    docBody.addEventListener("click", onClick, true);

    return () => {
      try {
        docBody.removeEventListener("mouseover", onMouseOver, true);
        docBody.removeEventListener("mouseout", onMouseOut, true);
        docBody.removeEventListener("click", onClick, true);
      } catch {
        /* iframe detached */
      }
      cleanupHideOverlays(doc);
    };
  }, [editMode]);

  // Mode "text" : click sur un texte pour l'éditer
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc || !iframeDoc.body) return;
    const doc: Document = iframeDoc;
    const docBody: HTMLElement = iframeDoc.body;

    if (editMode !== "text") {
      cleanupTextOverlays(doc);
      return;
    }

    const styleEl = doc.createElement("style");
    styleEl.id = "__speetch-text-style";
    styleEl.textContent = TEXT_STYLE_CSS;
    doc.head.appendChild(styleEl);

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === docBody || target === doc.documentElement) {
        return;
      }
      if (!hasDirectTextContent(target)) return;
      doc.querySelectorAll(".__speetch-text-hover").forEach((el) =>
        el.classList.remove("__speetch-text-hover"),
      );
      target.classList.add("__speetch-text-hover");
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      target?.classList.remove("__speetch-text-hover");
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement | null;
      if (!target || target === docBody || target === doc.documentElement) {
        return;
      }
      const original = extractDirectText(target);
      if (!original) return;
      // current = ce qui est affiché actuellement (= textOverrides[original] s'il existe, sinon original)
      const current = textOverrides[original] ?? original;
      setTextEditTarget({ original, current });
      setTextEditValue(current);
    };

    docBody.addEventListener("mouseover", onMouseOver, true);
    docBody.addEventListener("mouseout", onMouseOut, true);
    docBody.addEventListener("click", onClick, true);

    return () => {
      try {
        docBody.removeEventListener("mouseover", onMouseOver, true);
        docBody.removeEventListener("mouseout", onMouseOut, true);
        docBody.removeEventListener("click", onClick, true);
      } catch {
        /* iframe detached */
      }
      cleanupTextOverlays(doc);
    };
  }, [editMode, textOverrides]);

  // Mode "chart" : click sur un tableau (création) ou un graphique
  // existant (édition) pour ouvrir la modal de config.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc || !iframeDoc.body) return;
    const doc: Document = iframeDoc;
    const docBody: HTMLElement = iframeDoc.body;

    if (editMode !== "chart") {
      cleanupChartOverlays(doc);
      return;
    }

    const styleEl = doc.createElement("style");
    styleEl.id = "__speetch-chart-style";
    styleEl.textContent = CHART_STYLE_CSS;
    doc.head.appendChild(styleEl);

    function findTargetForEvent(e: MouseEvent): HTMLElement | null {
      const path = e.composedPath() as EventTarget[];
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (node === docBody || node === doc.documentElement) return null;
        if (node.tagName === "TABLE") return node;
        if (node.hasAttribute(CHART_FIGURE_ATTR)) return node;
      }
      return null;
    }

    const onMouseOver = (e: MouseEvent) => {
      const target = findTargetForEvent(e);
      doc.querySelectorAll(".__speetch-chart-hover").forEach((el) =>
        el.classList.remove("__speetch-chart-hover"),
      );
      if (target) target.classList.add("__speetch-chart-hover");
    };

    const onMouseOut = () => {
      doc.querySelectorAll(".__speetch-chart-hover").forEach((el) =>
        el.classList.remove("__speetch-chart-hover"),
      );
    };

    const onClick = (e: MouseEvent) => {
      const target = findTargetForEvent(e);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      const selector = getCssPath(target);
      if (!selector) return;

      if (target.tagName === "TABLE") {
        const tbl = target as HTMLTableElement;
        const parsed = parseTableElement(tbl);
        if (!parsed) {
          setError("Tableau vide — rien à transformer.");
          return;
        }
        setChartTarget({
          kind: "table",
          selector,
          tableHeaders: parsed.headers,
          tableRows: parsed.rows,
          initialConfig: null,
        });
      } else {
        // chart existant
        const cfg = parseChartFigure(target);
        if (!cfg) {
          setError("Impossible de relire la configuration du graphique.");
          return;
        }
        // On essaie de retrouver la table source juste avant le figure
        // pour proposer les bonnes colonnes ; sinon on tombe en mode
        // édition sans table (juste type / titre / orientation).
        let tableForEdit: HTMLTableElement | null = null;
        let tableHeaders: string[] = [];
        let tableRows: string[][] = [];
        let walker: Element | null = target.previousElementSibling;
        while (walker) {
          if (walker.tagName === "TABLE") {
            tableForEdit = walker as HTMLTableElement;
            break;
          }
          walker = walker.previousElementSibling;
        }
        if (tableForEdit) {
          const parsed = parseTableElement(tableForEdit);
          if (parsed) {
            tableHeaders = parsed.headers;
            tableRows = parsed.rows;
          }
        }
        setChartTarget({
          kind: "chart",
          selector,
          tableHeaders,
          tableRows,
          initialConfig: cfg,
        });
      }
    };

    docBody.addEventListener("mouseover", onMouseOver, true);
    docBody.addEventListener("mouseout", onMouseOut, true);
    docBody.addEventListener("click", onClick, true);

    return () => {
      try {
        docBody.removeEventListener("mouseover", onMouseOver, true);
        docBody.removeEventListener("mouseout", onMouseOut, true);
        docBody.removeEventListener("click", onClick, true);
      } catch {
        /* iframe detached */
      }
      cleanupChartOverlays(doc);
    };
  }, [editMode]);

  // -------- Actions chart --------

  function onCancelChart() {
    setChartTarget(null);
  }

  function onConfirmChart(config: ChartConfig) {
    const target = chartTarget;
    if (!target) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) {
      setError("Iframe non disponible — recharge la page et réessaie.");
      return;
    }

    cleanupChartOverlays(doc);
    cleanupHideOverlays(doc);
    cleanupTextOverlays(doc);
    doc.querySelectorAll("style[data-speetch-hide]").forEach((el) => el.remove());
    doc.querySelectorAll("style[data-speetch-overlay]").forEach((el) =>
      el.remove(),
    );
    doc.querySelectorAll("script[data-speetch-overrides]").forEach((el) =>
      el.remove(),
    );

    let domTarget: Element | null = null;
    try {
      domTarget = doc.querySelector(target.selector);
    } catch {
      domTarget = null;
    }
    if (!domTarget) {
      setError(
        "Cible introuvable dans le document — peut-être modifiée entre temps. Recharge la page.",
      );
      return;
    }

    const figureHtml = buildChartFigureHtml(config);
    // On crée un nœud à partir du HTML pour pouvoir l'insérer proprement.
    const wrapper = doc.createElement("div");
    wrapper.innerHTML = figureHtml;
    const newFigure = wrapper.firstElementChild;
    if (!newFigure) {
      setError("Erreur de génération du graphique.");
      return;
    }

    if (target.kind === "table") {
      // Insère juste après la table source
      domTarget.insertAdjacentElement("afterend", newFigure);
    } else {
      // Remplace le chart existant
      domTarget.replaceWith(newFigure);
    }

    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}>\n`
      : "<!DOCTYPE html>\n";
    const newHtml = doctype + doc.documentElement.outerHTML;

    setChartTarget(null);
    setError(null);
    startTransition(async () => {
      const result = await updateContextRawHtml({
        profileId,
        contextId,
        rawHtml: newHtml,
        hiddenElements,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      flashSaved();
      router.refresh();
    });
  }

  // -------- Actions hide --------

  function onSaveHideClick() {
    setError(null);
    setConfirmHideOpen(true);
  }

  function onConfirmSaveHide() {
    startTransition(async () => {
      const result = await updateContextHiddenElements({
        profileId,
        contextId,
        hiddenElements,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirmHideOpen(false);
        return;
      }
      baselineHiddenRef.current = [...hiddenElements];
      setConfirmHideOpen(false);
      flashSaved();
    });
  }

  function onResetHide() {
    setHiddenElements([...baselineHiddenRef.current]);
  }

  function onRemoveHiddenSelector(sel: string) {
    setHiddenElements((prev) => prev.filter((s) => s !== sel));
  }

  function onDeleteHiddenClick() {
    if (hiddenElements.length === 0) return;
    setError(null);
    setConfirmDeleteOpen(true);
  }

  function onConfirmDeleteHidden() {
    startTransition(async () => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc) {
        setError("Iframe non disponible — recharge la page et réessaie.");
        setConfirmDeleteOpen(false);
        return;
      }

      const selectorsToDelete = [...hiddenElements];

      cleanupHideOverlays(doc);
      cleanupTextOverlays(doc);
      doc.querySelectorAll("style[data-speetch-hide]").forEach((el) =>
        el.remove(),
      );
      doc.querySelectorAll("script[data-speetch-overrides]").forEach((el) =>
        el.remove(),
      );

      let totalRemoved = 0;
      for (const selector of selectorsToDelete) {
        try {
          const matches = doc.querySelectorAll(selector);
          matches.forEach((el) => {
            el.remove();
            totalRemoved += 1;
          });
        } catch {
          /* selector invalide */
        }
      }

      if (totalRemoved === 0) {
        setError(
          "Aucun élément trouvé pour les sélecteurs — peut-être déjà supprimé.",
        );
        setConfirmDeleteOpen(false);
        return;
      }

      const doctype = doc.doctype
        ? `<!DOCTYPE ${doc.doctype.name}>\n`
        : "<!DOCTYPE html>\n";
      const newHtml = doctype + doc.documentElement.outerHTML;

      const result = await updateContextRawHtml({
        profileId,
        contextId,
        rawHtml: newHtml,
        hiddenElements: [],
      });

      if (!result.ok) {
        setError(result.error);
        setConfirmDeleteOpen(false);
        return;
      }

      setHiddenElements([]);
      baselineHiddenRef.current = [];
      setEditMode("none");
      setConfirmDeleteOpen(false);
      flashSaved();
      router.refresh();
    });
  }

  // -------- Actions text --------

  function onApplyTextEdit() {
    if (!textEditTarget) return;
    const { original } = textEditTarget;
    const next = textEditValue;
    setTextOverrides((prev) => {
      const copy = { ...prev };
      if (next === original) {
        delete copy[original];
      } else {
        copy[original] = next;
      }
      return copy;
    });
    setTextEditTarget(null);
  }

  function onCancelTextEdit() {
    setTextEditTarget(null);
  }

  function onRemoveTextOverride(original: string) {
    setTextOverrides((prev) => {
      const copy = { ...prev };
      delete copy[original];
      return copy;
    });
  }

  function onResetText() {
    setTextOverrides({ ...baselineTextRef.current });
  }

  function onSaveTextClick() {
    setError(null);
    setConfirmTextOpen(true);
  }

  function onConfirmSaveText() {
    startTransition(async () => {
      const result = await updateContextTextOverrides({
        profileId,
        contextId,
        textOverrides,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirmTextOpen(false);
        return;
      }
      baselineTextRef.current = { ...textOverrides };
      setConfirmTextOpen(false);
      flashSaved();
    });
  }

  function flashSaved() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  // -------- Actions édition HTML brut --------

  function onOpenHtmlEditor() {
    setError(null);
    setHtmlEditValue(rawHtml);
    setHtmlEditOpen(true);
  }

  function onCloseHtmlEditor() {
    setHtmlEditOpen(false);
  }

  function onSaveHtmlClick() {
    if (htmlEditValue.trim() === rawHtml.trim()) {
      setHtmlEditOpen(false);
      return;
    }
    setConfirmHtmlOpen(true);
  }

  function onConfirmSaveHtml() {
    startTransition(async () => {
      const result = await updateContextRawHtml({
        profileId,
        contextId,
        rawHtml: htmlEditValue,
        hiddenElements,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirmHtmlOpen(false);
        return;
      }
      setConfirmHtmlOpen(false);
      setHtmlEditOpen(false);
      flashSaved();
      router.refresh();
    });
  }

  const overrideEntries = Object.entries(textOverrides);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/45">
            Mode édition
          </span>
          <span className="font-serif text-sm italic text-white/55">
            {editMode === "hide" &&
              "Clique sur un bloc dans la page pour le masquer / le réafficher"}
            {editMode === "text" &&
              "Clique sur un texte dans la page pour le modifier"}
            {editMode === "chart" &&
              "Clique sur un tableau pour le transformer en graphique — ou sur un graphique existant pour le modifier"}
            {editMode === "none" &&
              "Choisis un mode pour modifier le rendu de la note"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ModeToggle current={editMode} onChange={setEditMode} />
          <SpeetchStyleButton
            profileId={profileId}
            contextId={contextId}
            initialEnabled={applySpeetchDs}
            variant="full"
          />
          <AddBlockPanel profileId={profileId} contextId={contextId} />
          <Button onClick={onOpenHtmlEditor} variant="ghost">
            Éditer HTML
          </Button>
          {savedFlash && (
            <span className="ml-2 text-[10px] uppercase tracking-[0.32em] text-emerald-300/85">
              ✓ Sauvegardé
            </span>
          )}
        </div>
      </div>

      {/* Section hide */}
      {(hiddenElements.length > 0 || hideDirty || editMode === "hide") && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.4em] text-white/45">
              Blocs masqués · {hiddenElements.length}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {hideDirty && (
                <>
                  <Button onClick={onResetHide} variant="ghost">
                    Annuler
                  </Button>
                  <Button
                    onClick={onSaveHideClick}
                    variant="primary"
                    disabled={pending}
                  >
                    {pending ? "…" : "Masquer (CSS)"}
                  </Button>
                </>
              )}
              {hiddenElements.length > 0 && (
                <Button
                  onClick={onDeleteHiddenClick}
                  variant="danger"
                  disabled={pending}
                >
                  Supprimer du HTML
                </Button>
              )}
            </div>
          </div>
          {hiddenElements.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {hiddenElements.map((sel) => (
                <li key={sel}>
                  <button
                    type="button"
                    onClick={() => onRemoveHiddenSelector(sel)}
                    className="group inline-flex max-w-[420px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-white/70 transition-colors hover:border-red-400/40 hover:bg-red-400/5 hover:text-red-200"
                    title="Cliquer pour retirer du masquage"
                  >
                    <span className="truncate">{sel}</span>
                    <span className="text-white/30 group-hover:text-red-300">
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Section text overrides */}
      {(overrideEntries.length > 0 || textDirty || editMode === "text") && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.4em] text-white/45">
              Textes modifiés · {overrideEntries.length}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {textDirty && (
                <>
                  <Button onClick={onResetText} variant="ghost">
                    Annuler
                  </Button>
                  <Button
                    onClick={onSaveTextClick}
                    variant="primary"
                    disabled={pending}
                  >
                    {pending ? "…" : "Enregistrer texte"}
                  </Button>
                </>
              )}
            </div>
          </div>
          {overrideEntries.length > 0 && (
            <ul className="flex flex-col gap-2">
              {overrideEntries.map(([original, custom]) => (
                <li key={original}>
                  <button
                    type="button"
                    onClick={() => onRemoveTextOverride(original)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-[12px] text-white/70 transition-colors hover:border-red-400/40 hover:bg-red-400/5 hover:text-red-200"
                    title="Cliquer pour retirer la modification"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-white/40 line-through">
                        {original}
                      </span>
                      <span className="truncate font-serif italic">
                        {custom}
                      </span>
                    </span>
                    <span className="text-white/30 group-hover:text-red-300">
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Iframe */}
      <div
        className={`w-full overflow-hidden rounded-2xl border bg-white transition-colors ${
          editMode === "hide"
            ? "border-red-400/40"
            : editMode === "text"
              ? "border-amber-300/40"
              : editMode === "chart"
                ? "border-sky-400/40"
                : "border-white/10"
        }`}
      >
        <iframe
          ref={iframeRef}
          title={title}
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

      {/* Modale d'édition de texte */}
      <Modal
        open={textEditTarget !== null}
        size="compact"
        onClose={onCancelTextEdit}
      >
        <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">
            Édition de texte
          </p>
          <h2
            className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
          >
            Modifier ce texte
          </h2>
          {textEditTarget && (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-white/55">
              Original : <span className="text-white/75">{textEditTarget.original}</span>
            </p>
          )}
          <Field label="Nouveau texte">
            <textarea
              value={textEditValue}
              onChange={(e) => setTextEditValue(e.target.value)}
              autoFocus
              rows={Math.max(2, textEditValue.split("\n").length)}
              className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] p-4 font-serif text-base text-[#F5F5F7]/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none"
            />
          </Field>
          <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
            <Button variant="ghost" onClick={onCancelTextEdit}>
              Annuler
            </Button>
            <Button variant="primary" onClick={onApplyTextEdit}>
              Appliquer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmations */}
      <ConfirmDialog
        open={confirmHideOpen}
        tone="danger"
        title={
          hideDiff.added.length > 0 && hideDiff.removed.length === 0
            ? `Masquer ${hideDiff.added.length} bloc${hideDiff.added.length > 1 ? "s" : ""} ?`
            : hideDiff.removed.length > 0 && hideDiff.added.length === 0
              ? `Réafficher ${hideDiff.removed.length} bloc${hideDiff.removed.length > 1 ? "s" : ""} ?`
              : "Mettre à jour les blocs masqués ?"
        }
        description={<HideDiffDescription diff={hideDiff} />}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirmSaveHide}
        onCancel={() => setConfirmHideOpen(false)}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        tone="danger"
        title={`Supprimer ${hiddenElements.length} bloc${hiddenElements.length > 1 ? "s" : ""} du HTML ?`}
        description={<DeleteDescription selectors={hiddenElements} />}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirmDeleteHidden}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <ConfirmDialog
        open={confirmTextOpen}
        tone="warning"
        title={`Enregistrer ${textDiff.added.length + textDiff.changed.length + textDiff.removed.length} modification${
          textDiff.added.length + textDiff.changed.length + textDiff.removed.length > 1 ? "s" : ""
        } de texte ?`}
        description={<TextDiffDescription diff={textDiff} />}
        confirmLabel="Enregistrer"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirmSaveText}
        onCancel={() => setConfirmTextOpen(false)}
      />

      {/* Éditeur HTML brut */}
      <Modal
        open={htmlEditOpen}
        size="panel"
        onClose={pending ? () => {} : onCloseHtmlEditor}
      >
        <div className="flex h-full max-h-[85vh] flex-col gap-5 px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/55">
              Édition HTML brut
            </p>
            <h2
              className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
            >
              Modifier le HTML de la note
            </h2>
            <p className="font-serif text-sm italic text-white/45">
              Modification directe du <code className="font-mono text-white/65">meta.raw_html</code>.
              Les sélecteurs masqués et textes modifiés ne sont pas touchés —
              s&apos;ils ne matchent plus le nouveau HTML, ils s&apos;ignoreront silencieusement.
            </p>
          </div>
          <textarea
            value={htmlEditValue}
            onChange={(e) => setHtmlEditValue(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 w-full resize-none rounded-lg border border-white/10 bg-black/60 p-4 font-mono text-[12px] leading-relaxed text-white/85 focus:border-white/40 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-6 border-t border-white/10 pt-5">
            <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">
              {htmlEditValue.length.toLocaleString("fr-FR")} caractères
            </span>
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={onCloseHtmlEditor}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={onSaveHtmlClick}
                disabled={pending || htmlEditValue.trim() === rawHtml.trim()}
              >
                {pending ? "Enregistrement…" : "Enregistrer le HTML"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmHtmlOpen}
        tone="warning"
        title="Remplacer le HTML de la note ?"
        description={
          <span className="flex flex-col gap-2">
            <span className="text-sm italic text-white/55">
              Le HTML stocké en base sera remplacé par la version actuelle de
              l&apos;éditeur. Action <em className="not-italic font-semibold text-amber-200/85">irréversible</em> —
              il n&apos;y a pas d&apos;historique des versions précédentes.
            </span>
            <span className="text-sm italic text-white/45">
              Si la note est publiée, le snapshot côté espace client reste
              inchangé — toggle off / on pour le rafraîchir.
            </span>
          </span>
        }
        confirmLabel="Remplacer"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirmSaveHtml}
        onCancel={() => setConfirmHtmlOpen(false)}
      />

      <AlertDialog
        open={error !== null}
        title="Erreur"
        description={error}
        onClose={() => setError(null)}
      />

      {chartTarget && (
        <ChartModal
          open={true}
          initialConfig={chartTarget.initialConfig}
          initialTableHeaders={chartTarget.tableHeaders}
          initialTableRows={chartTarget.tableRows}
          onCancel={onCancelChart}
          onConfirm={onConfirmChart}
        />
      )}
    </div>
  );
}

// -------- Sub-components --------

function ModeToggle({
  current,
  onChange,
}: {
  current: "none" | "hide" | "text" | "chart";
  onChange: (next: "none" | "hide" | "text" | "chart") => void;
}) {
  const buttons: Array<{
    value: "none" | "hide" | "text" | "chart";
    label: string;
  }> = [
    { value: "none", label: "Visualisation" },
    { value: "hide", label: "Masquer" },
    { value: "text", label: "Édition texte" },
    { value: "chart", label: "Graphiques" },
  ];
  return (
    <div className="inline-flex items-center gap-px overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
      {buttons.map((b) => {
        const active = b.value === current;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.32em] transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

function HideDiffDescription({
  diff,
}: {
  diff: { added: string[]; removed: string[] };
}) {
  return (
    <span className="flex flex-col gap-4">
      {diff.added.length > 0 && (
        <span className="flex flex-col gap-2">
          <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-red-300/85">
            Masquer · {diff.added.length}
          </span>
          <span className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[11px] not-italic text-white/70">
            {diff.added.map((s) => (
              <span key={s} className="truncate">
                {s}
              </span>
            ))}
          </span>
        </span>
      )}
      {diff.removed.length > 0 && (
        <span className="flex flex-col gap-2">
          <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-emerald-300/85">
            Réafficher · {diff.removed.length}
          </span>
          <span className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[11px] not-italic text-white/70">
            {diff.removed.map((s) => (
              <span key={s} className="truncate">
                {s}
              </span>
            ))}
          </span>
        </span>
      )}
      <span className="text-sm italic text-white/45">
        Les sélecteurs CSS sont stockés en base et appliqués à chaque visite.
      </span>
    </span>
  );
}

function DeleteDescription({ selectors }: { selectors: string[] }) {
  return (
    <span className="flex flex-col gap-4">
      <span className="flex flex-col gap-2">
        <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-red-300/85">
          Suppression physique · {selectors.length}
        </span>
        <span className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[11px] not-italic text-white/70">
          {selectors.map((s) => (
            <span key={s} className="truncate">
              {s}
            </span>
          ))}
        </span>
      </span>
      <span className="text-sm italic text-white/45">
        Les éléments sélectionnés sont retirés du HTML stocké en base. Cette
        action est{" "}
        <em className="not-italic font-semibold text-red-200/85">
          irréversible
        </em>{" "}
        — pour les retrouver, il faudra recréer la note depuis la source.
      </span>
    </span>
  );
}

function TextDiffDescription({
  diff,
}: {
  diff: {
    added: Array<[string, string]>;
    removed: Array<[string, string]>;
    changed: Array<[string, string, string]>;
  };
}) {
  return (
    <span className="flex flex-col gap-4">
      {diff.added.length > 0 && (
        <span className="flex flex-col gap-2">
          <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-amber-300/85">
            Nouveaux · {diff.added.length}
          </span>
          <span className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] not-italic text-white/70">
            {diff.added.map(([o, n]) => (
              <span key={o} className="flex flex-col">
                <span className="truncate text-white/40 line-through">
                  {o}
                </span>
                <span className="truncate font-serif italic">{n}</span>
              </span>
            ))}
          </span>
        </span>
      )}
      {diff.changed.length > 0 && (
        <span className="flex flex-col gap-2">
          <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-amber-300/85">
            Modifiés · {diff.changed.length}
          </span>
          <span className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] not-italic text-white/70">
            {diff.changed.map(([o, b, n]) => (
              <span key={o} className="flex flex-col">
                <span className="truncate text-white/40">{o}</span>
                <span className="truncate text-red-300/70 line-through">
                  {b}
                </span>
                <span className="truncate font-serif italic">{n}</span>
              </span>
            ))}
          </span>
        </span>
      )}
      {diff.removed.length > 0 && (
        <span className="flex flex-col gap-2">
          <span className="text-[11px] uppercase not-italic tracking-[0.32em] text-emerald-300/85">
            Restaurés · {diff.removed.length}
          </span>
          <span className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] not-italic text-white/70">
            {diff.removed.map(([o]) => (
              <span key={o} className="truncate">
                {o}
              </span>
            ))}
          </span>
        </span>
      )}
      <span className="text-sm italic text-white/45">
        Les modifications sont stockées dans text_overrides et appliquées par
        script injecté au chargement de l&apos;iframe.
      </span>
    </span>
  );
}

// -------- Helpers (srcDoc + DOM utils) --------

/**
 * Construit le HTML final injecté dans l'iframe :
 *  - Une <style data-speetch-hide> pour les hidden_elements
 *  - Un <script data-speetch-overrides> pour appliquer text_overrides
 */
function buildSrcDoc(
  html: string,
  hiddenSelectors: string[],
  textOverrides: Record<string, string>,
  applySpeetchDs: boolean,
): string {
  let result = html;
  result = injectHideStyles(result, hiddenSelectors);
  if (applySpeetchDs) {
    result = injectSpeetchOverlay(result);
  }
  result = injectOverridesScript(result, textOverrides);
  return result;
}

/**
 * Injecte la feuille de style Speetch en TOUTE FIN de <head> (ou en début
 * de body si pas de </head>), avec les règles !important pour outre-passer
 * les styles inline / classes du HTML source.
 */
function injectSpeetchOverlay(html: string): string {
  const escaped = SPEETCH_OVERLAY_CSS.replace(/<\/style/gi, "<\\/style");
  const styleBlock = `\n<style data-speetch-overlay="true">\n${escaped}\n</style>\n`;
  const headCloseIdx = html.toLowerCase().lastIndexOf("</head>");
  if (headCloseIdx >= 0) {
    return html.slice(0, headCloseIdx) + styleBlock + html.slice(headCloseIdx);
  }
  const bodyOpenIdx = html.toLowerCase().indexOf("<body");
  if (bodyOpenIdx >= 0) {
    const bodyTagEnd = html.indexOf(">", bodyOpenIdx);
    if (bodyTagEnd >= 0) {
      return (
        html.slice(0, bodyTagEnd + 1) +
        styleBlock +
        html.slice(bodyTagEnd + 1)
      );
    }
  }
  return styleBlock + html;
}

function injectHideStyles(html: string, selectors: string[]): string {
  if (selectors.length === 0) return html;
  const escaped = selectors
    .map((s) => s.replace(/\\/g, "\\\\").replace(/<\/style/gi, "<\\/style"))
    .join(",\n");
  const styleBlock = `\n<style data-speetch-hide="true">\n${escaped} {\n  display: none !important;\n}\n</style>\n`;
  const headCloseIdx = html.toLowerCase().lastIndexOf("</head>");
  if (headCloseIdx >= 0) {
    return html.slice(0, headCloseIdx) + styleBlock + html.slice(headCloseIdx);
  }
  const bodyOpenIdx = html.toLowerCase().indexOf("<body");
  if (bodyOpenIdx >= 0) {
    const bodyTagEnd = html.indexOf(">", bodyOpenIdx);
    if (bodyTagEnd >= 0) {
      return (
        html.slice(0, bodyTagEnd + 1) +
        styleBlock +
        html.slice(bodyTagEnd + 1)
      );
    }
  }
  return styleBlock + html;
}

function injectOverridesScript(
  html: string,
  textOverrides: Record<string, string>,
): string {
  if (Object.keys(textOverrides).length === 0) return html;
  const escaped = JSON.stringify(textOverrides).replace(
    /<\/script/gi,
    "<\\/script",
  );
  const script = `
<script data-speetch-overrides="true">
(function() {
  try {
    var TEXTS = ${escaped};
    function applyTexts() {
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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyTexts);
    } else {
      applyTexts();
    }
  } catch (e) {
    console.error('[speetch-overrides] error:', e);
  }
})();
</script>`;
  const bodyCloseIdx = html.toLowerCase().lastIndexOf("</body>");
  if (bodyCloseIdx >= 0) {
    return html.slice(0, bodyCloseIdx) + script + html.slice(bodyCloseIdx);
  }
  return html + script;
}

const HIDE_STYLE_CSS = `
.__speetch-hide-hover {
  outline: 2px solid rgba(220, 38, 38, 0.9) !important;
  outline-offset: 1px !important;
  cursor: pointer !important;
  background: rgba(220, 38, 38, 0.08) !important;
}
html, body, .__speetch-hide-hover, .__speetch-hide-hover * {
  user-select: none !important;
}
`;

const TEXT_STYLE_CSS = `
.__speetch-text-hover {
  outline: 2px solid rgba(251, 191, 36, 0.9) !important;
  outline-offset: 1px !important;
  cursor: text !important;
  background: rgba(251, 191, 36, 0.10) !important;
}
`;

const CHART_STYLE_CSS = `
.__speetch-chart-hover {
  outline: 2px solid rgba(56, 189, 248, 0.9) !important;
  outline-offset: 2px !important;
  cursor: pointer !important;
  background: rgba(56, 189, 248, 0.06) !important;
}
`;

function cleanupHideOverlays(doc: Document) {
  try {
    doc.querySelectorAll(".__speetch-hide-hover").forEach((el) =>
      el.classList.remove("__speetch-hide-hover"),
    );
    doc.querySelector("#__speetch-hide-style")?.remove();
  } catch {
    /* ignore */
  }
}

function cleanupTextOverlays(doc: Document) {
  try {
    doc.querySelectorAll(".__speetch-text-hover").forEach((el) =>
      el.classList.remove("__speetch-text-hover"),
    );
    doc.querySelector("#__speetch-text-style")?.remove();
  } catch {
    /* ignore */
  }
}

function cleanupChartOverlays(doc: Document) {
  try {
    doc.querySelectorAll(".__speetch-chart-hover").forEach((el) =>
      el.classList.remove("__speetch-chart-hover"),
    );
    doc.querySelector("#__speetch-chart-style")?.remove();
  } catch {
    /* ignore */
  }
}

/**
 * Vrai si l'élément a au moins un text node direct non-vide. Évite que
 * le mode édition texte capte les clicks sur des wrappers vides.
 */
function hasDirectTextContent(el: HTMLElement): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.nodeValue ?? "").trim().length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Concatène les text nodes directs (descendants immédiats) de l'élément
 * et renvoie le résultat trimmé. Utilisé comme clé text_overrides pour
 * que les changements survivent à un re-render de l'iframe.
 */
function extractDirectText(el: HTMLElement): string | null {
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      const text = (node.nodeValue ?? "").trim();
      if (text) parts.push(text);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(" ");
}

function getCssPath(el: HTMLElement): string | null {
  if (!el || el.nodeType !== 1) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 30) {
    if (cur.tagName === "BODY" || cur.tagName === "HTML") break;
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    let part = cur.tagName.toLowerCase();
    const parentEl: Element | null = cur.parentElement;
    if (parentEl) {
      const currentTag = cur.tagName;
      const siblings: Element[] = Array.from(parentEl.children).filter(
        (s: Element) => s.tagName === currentTag,
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    cur = parentEl;
    depth += 1;
  }
  if (parts.length === 0) return null;
  return parts.join(" > ");
}
