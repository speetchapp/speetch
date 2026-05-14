import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne intelligemment des classes Tailwind (clsx + tailwind-merge).
 * À utiliser partout dans le projet pour composer des classes conditionnelles.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
