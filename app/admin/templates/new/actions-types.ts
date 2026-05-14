/**
 * Types pour les Server Actions de gestion des templates en BDD.
 * Hors fichier "use server" car les exports d'un tel fichier doivent être
 * uniquement des async functions.
 */

export type CreateTemplateState = {
  status: "idle" | "success" | "error";
  error?: string;
};

export type DeleteTemplateState = {
  status: "idle" | "success" | "error";
  error?: string;
};
