/**
 * <Snippet> — bloc de code pré-formaté pour la documentation Speetch.
 *
 * Pre + whitespace-pre-wrap + border-white/10 + bg-black/40 + mono 11px.
 * Pas de coloration syntaxique (volontaire — c'est de la doc, pas un éditeur).
 *
 * Documentation : /admin/settings/design-system § 43 Code blocks.
 */

import { cn } from "@/lib/utils";

export function Snippet({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "w-full max-w-md whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/55 md:w-auto md:min-w-[260px]",
        className,
      )}
    >
      {children}
    </pre>
  );
}
