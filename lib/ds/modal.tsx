"use client";

/**
 * <Modal> — overlay plein écran sur mobile, panel centré max-w-5xl sur desktop.
 *
 * - Backdrop noir 85% + blur-sm + click-outside pour fermer
 * - Esc pour fermer
 * - Entrée framer-motion : opacity + y:18 → 0 (400ms, ease-out-expo)
 * - Header optionnel (title + sub-title + actions à droite + bouton fermer)
 * - Rendu via React Portal sur document.body — permet l'empilement correct
 *   d'une Modal dans une autre (ex: ConfirmDialog au-dessus de MediaLibraryModal).
 *
 * Documentation : /admin/settings/design-system § 10 Modales.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Modal({
  open,
  onClose,
  children,
  className,
  /**
   * - `panel` (défaut) : pleine hauteur sur mobile, max-w-5xl 85vh sur desktop.
   *   Idéal pour la médiathèque, les éditeurs, les listings.
   * - `compact` : carte centrée petite (max-w-md), rounded sur mobile aussi.
   *   Idéal pour les dialogues de confirmation et d'alerte.
   */
  size = "panel",
  /** z-index custom. Défaut z-[80] pour passer au-dessus de la sidebar. */
  zIndex = 80,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "panel" | "compact";
  zIndex?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm",
            size === "panel"
              ? "items-stretch md:items-center md:p-6"
              : "p-4 md:p-6",
          )}
          style={{ zIndex }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className={cn(
              "relative flex flex-col overflow-hidden bg-[#0a0a0a] border border-white/10",
              size === "panel"
                ? "h-full w-full max-w-5xl md:h-[85vh] md:rounded-2xl md:border md:border-white/10 max-md:border-0"
                : "w-full max-w-md rounded-2xl",
              className,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * <ModalHeader> — header avec title, sub-title, actions à droite et close.
 * À placer en premier enfant de <Modal>.
 */
export function ModalHeader({
  title,
  subtitle,
  actions,
  onClose,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5 md:px-8">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.32em] text-white/45">
          {title}
        </span>
        {subtitle && <span className="text-sm text-white/55">{subtitle}</span>}
      </div>
      <div className="flex items-center gap-6">
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-white"
        >
          Fermer
        </button>
      </div>
    </header>
  );
}
