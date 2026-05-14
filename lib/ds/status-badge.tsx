/**
 * <StatusBadge> — dot coloré + label uppercase. Indique un état (publié,
 * brouillon, erreur, succès, neutre).
 *
 * Pattern : <span class="flex items-center gap-1.5"><dot/> Label</span>.
 *
 * Documentation : /admin/settings/design-system § 07 Badges.
 */

import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-emerald-300/75",
  warning: "text-amber-300/75",
  danger: "text-red-300/80",
  neutral: "text-white/55",
  info: "text-white/85",
};

const TONE_DOT: Record<Tone, string> = {
  success: "bg-emerald-300",
  warning: "bg-amber-300",
  danger: "bg-red-300",
  neutral: "bg-white/55",
  info: "bg-[#F5F5F7]",
};

export function StatusBadge({
  tone = "neutral",
  pulsing = false,
  className,
  children,
}: {
  tone?: Tone;
  /** Active le ping-soft du dot — réservé aux "vraiment live". */
  pulsing?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.32em]",
        TONE_TEXT[tone],
        className,
      )}
    >
      {pulsing ? (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span
            className={cn("absolute inset-0 rounded-full animate-ping-soft", TONE_DOT[tone])}
          />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />
        </span>
      ) : (
        <span className={cn("block h-1 w-1 rounded-full", TONE_DOT[tone])} />
      )}
      {children}
    </span>
  );
}
