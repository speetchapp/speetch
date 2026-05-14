"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  flattenLeaves,
  setLeaf,
  type LeafField,
} from "./named-object";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

type TabLabel = { id: string; label: string };

/**
 * Éditeur "à onglets" pour un objet JS dont les clés top-level sont des
 * entiers (1, 2, 3…) et les valeurs des sous-objets. Utilisé pour des
 * structures type `const DIRECTIONS = { 1: {...}, 2: {...}, 3: {...} }`.
 *
 * Reçoit l'objet parsé. Mutate via le callback `onChange` à chaque édition
 * (le parent garde la copie de travail et la sérialise à la sauvegarde).
 *
 * Les images sont déclenchées via `onPickImage(field, current)` qui ouvre
 * la médiathèque côté parent — celui-ci appelle `onChange` quand l'image
 * est sélectionnée.
 */
export function DirectionsEditor({
  data,
  tabLabels,
  onChange,
  onPickImage,
  imagePickerOpenFor,
}: {
  data: Record<string, Record<string, unknown>>;
  tabLabels: TabLabel[];
  onChange: (next: Record<string, Record<string, unknown>>) => void;
  onPickImage: (tabId: string, field: LeafField) => void;
  imagePickerOpenFor: { tabId: string; path: string } | null;
}) {
  const tabIds = Object.keys(data);
  const [activeTab, setActiveTab] = useState<string>(tabIds[0]);

  const fieldsByTab = useMemo(() => {
    const map = new Map<string, LeafField[]>();
    for (const id of tabIds) {
      map.set(id, flattenLeaves(data[id]));
    }
    return map;
  }, [data, tabIds]);

  function update(tabId: string, path: string, newValue: string) {
    const next = { ...data };
    const cloned = JSON.parse(JSON.stringify(next[tabId]));
    setLeaf(cloned, path, newValue);
    next[tabId] = cloned;
    onChange(next);
  }

  // Groupement par préfixe (1er segment) pour l'affichage
  function groupByPrefix(fields: LeafField[]): Map<string, LeafField[]> {
    const map = new Map<string, LeafField[]>();
    for (const f of fields) {
      const segs = f.path.split(".");
      const group = segs.length > 1 ? segs[0] : "(racine)";
      const list = map.get(group) ?? [];
      list.push(f);
      map.set(group, list);
    }
    return map;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Directions"
        className="flex flex-wrap gap-px overflow-hidden rounded-2xl bg-white/[0.08]"
      >
        {tabLabels.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-5 py-4 text-left transition-colors ${
                active
                  ? "bg-white/[0.06] text-[#F5F5F7]"
                  : "bg-black text-white/55 hover:bg-white/[0.02] hover:text-white"
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.32em] text-white/40">
                Direction {String(Number(t.id) || t.id).padStart(2, "0")}
              </span>
              <span className="mt-1 block font-sans text-base font-light tracking-tight md:text-lg">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        className="flex flex-col gap-8"
      >
        {(() => {
          const fields = fieldsByTab.get(activeTab) ?? [];
          const groups = groupByPrefix(fields);
          return Array.from(groups.entries()).map(([groupName, groupFields]) => (
            <fieldset key={groupName} className="flex flex-col gap-4">
              <legend className="text-[11px] uppercase tracking-[0.32em] text-white/45">
                {groupName}
              </legend>
              <div className="flex flex-col gap-5">
                {groupFields.map((field) => (
                  <FieldRow
                    key={field.path}
                    field={field}
                    onChange={(v) => update(activeTab, field.path, v)}
                    onPickImage={() => onPickImage(activeTab, field)}
                    pickerOpen={
                      !!imagePickerOpenFor &&
                      imagePickerOpenFor.tabId === activeTab &&
                      imagePickerOpenFor.path === field.path
                    }
                  />
                ))}
              </div>
            </fieldset>
          ));
        })()}
      </motion.div>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onPickImage,
  pickerOpen,
}: {
  field: LeafField;
  onChange: (value: string) => void;
  onPickImage: () => void;
  pickerOpen: boolean;
}) {
  const shortPath = field.path.split(".").slice(1).join(".") || field.key;

  if (field.kind === "image") {
    const isUrl = /^https?:\/\//i.test(field.value);
    return (
      <div className="flex items-stretch gap-4">
        <button
          type="button"
          onClick={onPickImage}
          className={`group relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-black/40 transition ${
            pickerOpen
              ? "border-white/60 ring-2 ring-white/40"
              : "border-white/10 hover:border-white/40"
          }`}
        >
          {isUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={field.value}
              alt={field.key}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.28em] text-white/40">
              {field.value || "Aucune"}
            </span>
          )}
        </button>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-[11px] uppercase tracking-[0.32em] text-white/45">
            {shortPath}
          </label>
          <input
            type="text"
            value={field.value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border-b border-white/20 bg-transparent pb-2 font-mono text-xs text-white/75 caret-[#F5F5F7] focus:border-white/80 focus:outline-none"
          />
          <button
            type="button"
            onClick={onPickImage}
            className="self-start text-[10px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
          >
            Choisir dans la médiathèque
          </button>
        </div>
      </div>
    );
  }

  if (field.kind === "longtext" || field.kind === "html") {
    return (
      <label className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-white/45">
          <span>{shortPath}</span>
          {field.kind === "html" && (
            <span className="text-[10px] normal-case tracking-[0.2em] text-white/30">
              HTML autorisé
            </span>
          )}
        </span>
        <textarea
          rows={Math.min(8, Math.max(2, Math.ceil(field.value.length / 80)))}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] p-3 font-serif text-base text-[#F5F5F7]/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none md:text-lg"
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.32em] text-white/45">
        {shortPath}
      </span>
      <input
        type="text"
        value={field.value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-white/20 bg-transparent pb-2 font-sans text-base font-light text-[#F5F5F7] caret-[#F5F5F7] focus:border-white/80 focus:outline-none md:text-lg"
      />
    </label>
  );
}
