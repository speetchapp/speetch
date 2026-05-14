/**
 * <Chip> — pill rounded-full border + label uppercase.
 * Variantes pour signaler un type, une catégorie, un mode ou un statut.
 *
 * Documentation : /admin/settings/design-system § 07 Badges.
 */

import { cn } from "@/lib/utils";

type Tone = "default" | "muted" | "warning" | "success" | "danger" | "info";

const TONE: Record<Tone, string> = {
  default:
    "border-white/15 bg-white/[0.04] text-white/70",
  muted:
    "border-white/10 bg-white/[0.02] text-white/45",
  warning:
    "border-amber-300/30 bg-amber-300/[0.04] text-amber-200/80",
  success:
    "border-emerald-400/30 bg-emerald-400/[0.04] text-emerald-200/85",
  danger:
    "border-red-400/30 bg-red-400/[0.04] text-red-300/80",
  info:
    "border-white/40 bg-white/[0.04] text-white/85",
};

export function Chip({
  tone = "default",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.28em]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
