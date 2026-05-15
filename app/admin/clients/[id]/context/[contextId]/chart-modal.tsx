"use client";

import { useMemo, useState } from "react";
import { Button, Field, Modal } from "@/lib/ds";
import {
  buildChartConfigFromRows,
  generateChartSvg,
  type ChartConfig,
  type ChartType,
} from "../_lib/chart";

/**
 * Modal de configuration d'un graphique injecté dans une note. Affiche un
 * preview SVG live à chaque modification. En v1 seul "bar" est supporté
 * — l'UI prévoit l'extension à line/donut/area (placeholders disabled).
 *
 * Cas d'usage :
 *  - création depuis une table : `tableHeaders/Rows` peuplés, `initialConfig=null`
 *  - édition d'un chart existant : `initialConfig` fourni ; les
 *    `tableHeaders/Rows` peuvent être ceux de la table source si encore
 *    présente, sinon vides (mode édition limité à type/titre/orientation)
 */
export function ChartModal({
  open,
  initialConfig,
  initialTableHeaders,
  initialTableRows,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  initialConfig: ChartConfig | null;
  initialTableHeaders: string[];
  initialTableRows: string[][];
  onCancel: () => void;
  onConfirm: (config: ChartConfig) => void;
}) {
  const headers = initialTableHeaders;
  const rows = initialTableRows;
  const hasTableData = headers.length > 0 && rows.length > 0;

  const [type, setType] = useState<ChartType>(initialConfig?.type ?? "bar");
  const [title, setTitle] = useState<string>(initialConfig?.title ?? "");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(
    initialConfig?.orientation ?? "vertical",
  );
  const [xColumnIndex, setXColumnIndex] = useState<number>(
    initialConfig
      ? Math.max(0, headers.findIndex((h) => h === initialConfig.xLabel))
      : 0,
  );
  const [yColumnIndex, setYColumnIndex] = useState<number>(
    initialConfig
      ? Math.max(
          0,
          headers.findIndex((h) => h === initialConfig.yLabel),
        )
      : Math.min(1, headers.length - 1),
  );

  const previewConfig: ChartConfig | null = useMemo(() => {
    if (hasTableData) {
      return buildChartConfigFromRows({
        headers,
        rows,
        type,
        xColumnIndex,
        yColumnIndex,
        title: title.trim() || undefined,
        orientation,
      });
    }
    // Pas de table source : on garde labels/values de l'initial mais on
    // applique les changements de type/title/orientation.
    if (initialConfig) {
      return {
        ...initialConfig,
        type,
        title: title.trim() || undefined,
        orientation,
      };
    }
    return null;
  }, [
    hasTableData,
    headers,
    rows,
    initialConfig,
    type,
    xColumnIndex,
    yColumnIndex,
    title,
    orientation,
  ]);

  const previewSvg = useMemo(() => {
    if (!previewConfig) return null;
    if (previewConfig.values.length === 0) return null;
    return generateChartSvg(previewConfig);
  }, [previewConfig]);

  const tableMissing = !hasTableData && initialConfig === null;
  const tableHasNumeric = hasTableData
    ? rows.some((r) =>
        r.some((cell) => {
          const num = Number(cell.replace(/[^\d.,-]/g, "").replace(",", "."));
          return Number.isFinite(num) && cell.trim() !== "";
        }),
      )
    : true;

  function handleSubmit() {
    if (!previewConfig || previewConfig.values.length === 0) return;
    onConfirm(previewConfig);
  }

  return (
    <Modal open={open} size="panel" onClose={onCancel}>
      <div className="flex h-full max-h-[88vh] flex-col gap-6 px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/55">
            Graphique
          </p>
          <h2
            className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
          >
            {initialConfig ? "Modifier le graphique" : "Créer un graphique"}
          </h2>
          <p className="font-serif text-sm italic text-white/45">
            {hasTableData
              ? "Configure type, colonnes et titre. Le rendu se met à jour en temps réel."
              : "La table source n'est plus disponible — tu peux changer type / titre / orientation."}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto md:grid-cols-[280px_1fr]">
          {/* Config */}
          <div className="flex flex-col gap-5">
            <Field label="Type">
              <div className="flex flex-wrap gap-2">
                <TypeButton
                  active={type === "bar"}
                  onClick={() => setType("bar")}
                  label="Barres"
                />
                <TypeButton
                  active={false}
                  onClick={() => {}}
                  label="Courbe"
                  disabled
                />
                <TypeButton
                  active={false}
                  onClick={() => {}}
                  label="Donut"
                  disabled
                />
                <TypeButton
                  active={false}
                  onClick={() => {}}
                  label="Aire"
                  disabled
                />
              </div>
            </Field>

            <Field label="Titre" hint="optionnel">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Évolution KPI Q1"
                maxLength={120}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-sans text-sm font-light text-[#F5F5F7] placeholder:text-white/25 focus:border-white/60 focus:outline-none"
              />
            </Field>

            {hasTableData && (
              <>
                <Field label="Colonne catégorie (X)">
                  <select
                    value={xColumnIndex}
                    onChange={(e) => setXColumnIndex(Number(e.target.value))}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-light text-white/85 focus:border-white/60 focus:outline-none"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Col ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Colonne valeur (Y)">
                  <select
                    value={yColumnIndex}
                    onChange={(e) => setYColumnIndex(Number(e.target.value))}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-light text-white/85 focus:border-white/60 focus:outline-none"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Col ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field label="Orientation">
              <div className="inline-flex items-center gap-px overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                <OrientationButton
                  active={orientation === "vertical"}
                  onClick={() => setOrientation("vertical")}
                  label="Vertical"
                />
                <OrientationButton
                  active={orientation === "horizontal"}
                  onClick={() => setOrientation("horizontal")}
                  label="Horizontal"
                />
              </div>
            </Field>
          </div>

          {/* Preview */}
          <div className="flex min-h-[300px] flex-col gap-3 rounded-2xl border border-white/10 bg-white p-4">
            {previewSvg && previewConfig && previewConfig.values.length > 0 ? (
              <div
                className="flex-1 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <p className="font-serif text-sm italic text-black/40">
                  {tableMissing
                    ? "Configuration introuvable — annule et clique sur un tableau."
                    : !tableHasNumeric
                      ? "Aucune valeur numérique détectée dans ce tableau."
                      : "Choisis une colonne X / Y compatible pour voir le rendu."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 border-t border-white/10 pt-5">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!previewConfig || previewConfig.values.length === 0}
          >
            {initialConfig ? "Mettre à jour" : "Insérer le graphique"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TypeButton({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.32em] transition-colors ${
        active
          ? "border-white/40 bg-white/15 text-white"
          : disabled
            ? "cursor-not-allowed border-white/5 text-white/20"
            : "border-white/10 text-white/55 hover:border-white/30 hover:text-white"
      }`}
      title={disabled ? "Disponible prochainement" : undefined}
    >
      {label}
    </button>
  );
}

function OrientationButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-[11px] uppercase tracking-[0.32em] transition-colors ${
        active
          ? "bg-white/15 text-white"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
