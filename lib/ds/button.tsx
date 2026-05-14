"use client";

/**
 * <Button> — toutes les variantes de boutons Speetch dans un composant unique.
 *
 * Variantes :
 * - `primary` : CTA standard. Label uppercase tracking 0.32em white/75, hairline
 *   qui s'étend au hover. Le plus utilisé.
 * - `large` : CTA monumental landing. Text 2xl-3xl ExtraLight, hairline plus
 *   généreuse.
 * - `return` : Bouton de retour, hairline en PRÉFIXE avant le label.
 * - `ghost` : Utilitaire discret white/40 → white. Pas de hairline.
 * - `danger` : Comme ghost mais hover passe en red-300/80. Pour les actions
 *   destructives (toujours coupler avec un confirm).
 *
 * Si `href` est fourni → rendu via next/link. Sinon `<button>` natif.
 *
 * Documentation : /admin/settings/design-system § 52 Boutons.
 */

import Link from "next/link";
import { Hairline } from "./hairline";
import { cn } from "@/lib/utils";

type Variant = "primary" | "large" | "ghost" | "danger" | "return";

const VARIANT_BASE: Record<Variant, string> = {
  primary:
    "group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/75 transition-colors duration-300 hover:text-white",
  large:
    "group inline-flex items-center gap-4 text-2xl font-light text-[#F5F5F7] transition-colors md:text-3xl",
  return:
    "group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors duration-300 hover:text-white",
  ghost:
    "text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-white",
  danger:
    "text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-red-300/80",
};

const DISABLED_CLASS =
  "disabled:cursor-wait disabled:opacity-50";

type CommonProps = {
  variant?: Variant;
  className?: string;
  /** Texte affiché à la place de `children` quand `pending` est vrai. */
  pendingLabel?: string;
  pending?: boolean;
  children: React.ReactNode;
};

type AsButtonProps = CommonProps & {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  ariaLabel?: string;
};

type AsLinkProps = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
};

export function Button(props: AsButtonProps | AsLinkProps) {
  const variant = props.variant ?? "primary";
  const className = cn(
    VARIANT_BASE[variant],
    "pending" in props && props.pending && DISABLED_CLASS,
    props.className,
  );

  const inner = (
    <>
      {variant === "return" && <Hairline width="md" hover="lg" />}
      <span>
        {"pending" in props && props.pending
          ? (props.pendingLabel ?? props.children)
          : props.children}
      </span>
      {(variant === "primary" || variant === "large") && (
        <Hairline
          width={variant === "large" ? "lg" : "md"}
          hover={variant === "large" ? "xl" : "xl"}
        />
      )}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        target={props.target}
        rel={props.rel}
        aria-label={props.ariaLabel}
        className={className}
      >
        {inner}
      </Link>
    );
  }

  const buttonProps = props as AsButtonProps;
  return (
    <button
      type={buttonProps.type ?? "button"}
      onClick={buttonProps.onClick}
      disabled={buttonProps.disabled || (("pending" in props) && props.pending)}
      aria-label={buttonProps.ariaLabel}
      className={className}
    >
      {inner}
    </button>
  );
}
