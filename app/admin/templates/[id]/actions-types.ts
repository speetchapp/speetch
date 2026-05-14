/**
 * État partagé entre le formulaire d'édition et le Server Action.
 * Hors fichier "use server" (qui ne peut exporter que des async functions).
 */

export type UpdateTemplateState = {
  status: "idle" | "success" | "error";
  error?: string;
};
