/**
 * <Eyebrow> — le label uppercase en tracking large utilisé partout dans
 * Speetch comme indication de contexte au-dessus d'un titre, à droite d'une
 * action, ou comme label de field.
 *
 * Trois niveaux de tracking : sm (0.28em, chips/tags), md (0.32em, défaut
 * caption), lg (0.4em, eyebrow de section principale).
 *
 * Documentation : /admin/settings/design-system § 37 typography hierarchy.
 */

import { cn } from "@/lib/utils";

type Tracking = "sm" | "md" | "lg";
type Intensity = "muted" | "default" | "strong";

const TRACKING_CLASSES: Record<Tracking, string> = {
  sm: "tracking-[0.28em]",
  md: "tracking-[0.32em]",
  lg: "tracking-[0.4em]",
};

const INTENSITY_CLASSES: Record<Intensity, string> = {
  muted: "text-white/40",
  default: "text-white/55",
  strong: "text-white/85",
};

export function Eyebrow({
  tracking = "md",
  intensity = "default",
  as: Component = "span",
  className,
  children,
}: {
  /** Letter-spacing. sm = chip, md = caption (défaut), lg = section header. */
  tracking?: Tracking;
  /** Intensité de la couleur. muted = 40%, default = 55%, strong = 85%. */
  intensity?: Intensity;
  /** Élément HTML rendu (span par défaut). */
  as?: "span" | "p" | "div" | "label";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Component
      className={cn(
        "text-[11px] uppercase",
        TRACKING_CLASSES[tracking],
        INTENSITY_CLASSES[intensity],
        className,
      )}
    >
      {children}
    </Component>
  );
}
