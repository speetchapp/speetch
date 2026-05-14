/**
 * <Kbd> — pill stylisée pour une touche clavier.
 * <KbdCombo keys={[]}> — combinaison de touches avec séparateur "+".
 *
 * Glyphes recommandés : ⌘ (Cmd), ⇧ (Shift), ⌥ (Option), ⌃ (Ctrl), ↵ (Enter),
 * Esc, Tab, ↑ ↓ ← →. Plus élégant que "Cmd + S".
 *
 * Documentation : /admin/settings/design-system § 25 Kbd shortcuts.
 */

import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function KbdCombo({
  keys,
  separator = "+",
  className,
}: {
  /** Liste de touches dans l'ordre du combo : ["⌘", "K"] → ⌘ + K */
  keys: string[];
  /** Séparateur entre touches. Défaut "+". */
  separator?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <Kbd>{k}</Kbd>
          {i < keys.length - 1 && (
            <span className="text-white/30">{separator}</span>
          )}
        </span>
      ))}
    </span>
  );
}
