/**
 * <Hairline> — la ligne fine 1px qui s'étend au survol du parent.
 * Pattern signature Speetch utilisé sur tous les CTAs et boutons.
 *
 * À utiliser à l'intérieur d'un parent `.group` : la ligne suit la largeur
 * cible quand le parent est survolé.
 *
 * Documentation : /admin/settings/design-system § 50 et 52.
 */

import { cn } from "@/lib/utils";

type Width = "sm" | "md" | "lg" | "xl";

const WIDTH_CLASSES: Record<Width, string> = {
  sm: "w-3",
  md: "w-6",
  lg: "w-10",
  xl: "w-12",
};

const HOVER_CLASSES: Record<Width, string> = {
  sm: "group-hover:w-6",
  md: "group-hover:w-12",
  lg: "group-hover:w-20",
  xl: "group-hover:w-28",
};

export function Hairline({
  width = "md",
  hover = "xl",
  className,
}: {
  /** Largeur au repos. md = 24px (par défaut). */
  width?: Width;
  /** Largeur au hover. xl = 48px (par défaut). */
  hover?: Width;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-px bg-current transition-all duration-500 ease-out",
        WIDTH_CLASSES[width],
        HOVER_CLASSES[hover],
        className,
      )}
    />
  );
}
