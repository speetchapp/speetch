"use client";

/**
 * <ConfirmDialog> et <AlertDialog> — remplacent `window.confirm()` /
 * `window.alert()` natifs par des modales Speetch.
 *
 * Pattern : carte centrée max-w-md (Modal size="compact"), eyebrow contextuel,
 * titre monumental ExtraLight, description italique optionnelle, footer avec
 * action principale à droite.
 *
 * <ConfirmDialog> : deux boutons (annuler + confirmer). L'action de confirm
 * a un `tone="danger|warning|neutral"` qui colore le bouton primaire.
 *
 * <AlertDialog> : un seul bouton (OK). Pour afficher une erreur après une
 * action.
 *
 * Toutes deux doivent être pilotées par l'état du parent (open + onClose).
 *
 * Documentation : /admin/settings/design-system § 10 Modales / Dialogues.
 */

import { Modal } from "./modal";
import { Button } from "./button";
import { Eyebrow } from "./eyebrow";

type ConfirmTone = "danger" | "warning" | "neutral";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "danger",
  pending = false,
  zIndex = 90,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  /** z-index. Défaut 90 pour passer au-dessus d'une <Modal> standard (80). */
  zIndex?: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const eyebrowText =
    tone === "danger"
      ? "Action irréversible"
      : tone === "warning"
        ? "Attention"
        : "Confirmation";

  return (
    <Modal
      open={open}
      size="compact"
      zIndex={zIndex}
      onClose={pending ? () => {} : onCancel}
    >
      <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <Eyebrow tracking="md" intensity="strong">
          {eyebrowText}
        </Eyebrow>
        <h2
          className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
        >
          {title}
        </h2>
        {description && (
          <p className="font-serif text-base italic text-white/60 md:text-lg">
            {description}
          </p>
        )}
        <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            pending={pending}
            pendingLabel="En cours…"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type AlertTone = "danger" | "info";

export function AlertDialog({
  open,
  title,
  description,
  closeLabel = "OK",
  tone = "danger",
  zIndex = 95,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  closeLabel?: string;
  tone?: AlertTone;
  /** z-index. Défaut 95 — au-dessus d'un ConfirmDialog (90). */
  zIndex?: number;
  onClose: () => void;
}) {
  const eyebrowText = tone === "danger" ? "Erreur" : "Information";

  return (
    <Modal open={open} size="compact" zIndex={zIndex} onClose={onClose}>
      <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <Eyebrow
          tracking="md"
          intensity="strong"
          className={tone === "danger" ? "text-red-300/80" : undefined}
        >
          {eyebrowText}
        </Eyebrow>
        <h2
          className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
        >
          {title}
        </h2>
        {description && (
          <p className="font-serif text-base italic text-white/60 md:text-lg">
            {description}
          </p>
        )}
        <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
          <Button variant="primary" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
