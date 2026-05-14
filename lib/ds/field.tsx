/**
 * <Field> — wrapper label + hint + input/textarea/select.
 *
 * Le pattern de formulaire Speetch : un <label> qui contient un header en
 * uppercase 0.32em (label gauche, hint à droite white/25), puis l'input.
 *
 * Documentation : /admin/settings/design-system § 06 Formulaires.
 */

import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  /** Texte aligné à droite du label (ex: "obligatoire", "max 2 MB"). */
  hint?: string;
  /** Input, textarea, select, file input… */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-3", className)}>
      <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-white/45">
        <span>{label}</span>
        {hint ? <span className="text-white/25">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
