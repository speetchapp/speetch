/**
 * <Sceau> — le cercle initiale Speetch / client.
 *
 * Initiale Fraunces italique inscrite dans un cercle bordé. Quatre tailles
 * canoniques (sm/md/lg/xl) et quatre variantes (default/strong/muted/inverse).
 *
 * Documentation : /admin/settings/design-system § 39 Logo & brand.
 */

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "default" | "strong" | "muted" | "inverse";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-10 w-10 text-base",
  md: "h-12 w-12 text-lg",
  lg: "h-16 w-16 text-2xl",
  xl: "h-20 w-20 text-3xl",
};

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "border border-white/40 text-[#F5F5F7]",
  strong: "border border-white/85 text-[#F5F5F7]",
  muted: "border border-white/15 text-white/65",
  inverse: "border border-[#F5F5F7] bg-[#F5F5F7] text-black",
};

export function Sceau({
  letter,
  size = "md",
  variant = "default",
  className,
}: {
  /** Initiale unique (1 lettre). Pour Speetch = "S", Club Abrazo = "A", etc. */
  letter: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-serif font-light italic",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <em>{letter}</em>
    </span>
  );
}
