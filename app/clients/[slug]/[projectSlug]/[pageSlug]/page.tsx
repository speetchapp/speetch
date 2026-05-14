import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionCookieName, verifySession } from "@/lib/crypto";
import { isValidSlug } from "@/lib/slug";
import type { PageContent } from "@/types/database";
import { PublicPageView } from "./public-page-view";
import { DocumentPageView } from "./document-page-view";
import { RawHtmlPageView } from "./raw-html-page-view";
import { FwaPageView } from "./fwa-page-view";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; projectSlug: string; pageSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, projectSlug, pageSlug } = await params;
  if (!isValidSlug(slug) || !isValidSlug(projectSlug) || !isValidSlug(pageSlug)) {
    return { title: "Page introuvable", robots: { index: false, follow: false } };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("client_pages")
    .select("page_name, client_name")
    .eq("client_slug", slug)
    .eq("project_slug", projectSlug)
    .eq("page_slug", pageSlug)
    .maybeSingle();

  if (!data) {
    return { title: "Page introuvable", robots: { index: false, follow: false } };
  }

  return {
    title: `${data.page_name ?? "Page"} · ${data.client_name ?? "Speetch"}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicPageRoute({ params }: Props) {
  const { slug, projectSlug, pageSlug } = await params;
  if (!isValidSlug(slug) || !isValidSlug(projectSlug) || !isValidSlug(pageSlug)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: page } = await supabase
    .from("client_pages")
    .select(
      "profile_id, client_slug, client_name, project_id, project_slug, project_name, project_type, page_id, page_slug, page_name, page_content, page_created_at, page_updated_at",
    )
    .eq("client_slug", slug)
    .eq("project_slug", projectSlug)
    .eq("page_slug", pageSlug)
    .maybeSingle();

  if (
    !page ||
    !page.profile_id ||
    !page.project_id ||
    !page.client_slug ||
    !page.project_slug ||
    !page.page_slug
  ) {
    notFound();
  }

  // Cookie gate — réutilise le même cookie que /clients/[slug]
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(getSessionCookieName(page.profile_id))?.value;
  const unlocked = verifySession(page.profile_id, sessionValue);

  if (!unlocked) {
    // Renvoie vers la racine de l'espace pour afficher le gate.
    redirect(`/clients/${slug}`);
  }

  // Précédent / Suivant — fetch des autres pages publiées du même projet
  const { data: siblings } = await supabase
    .from("client_pages")
    .select("page_id, page_slug, page_name, page_position")
    .eq("project_id", page.project_id)
    .order("page_position", { ascending: true });

  const ordered = siblings ?? [];
  const currentIdx = ordered.findIndex((p) => p.page_id === page.page_id);
  const prev = currentIdx > 0 ? ordered[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < ordered.length - 1
      ? ordered[currentIdx + 1]
      : null;

  const content = (page.page_content as PageContent) ?? {};
  const prevTarget =
    prev && prev.page_slug && prev.page_name
      ? { slug: prev.page_slug, name: prev.page_name }
      : null;
  const nextTarget =
    next && next.page_slug && next.page_name
      ? { slug: next.page_slug, name: next.page_name }
      : null;

  const style = content.meta?.style;

  const navPages = ordered
    .filter(
      (p): p is { page_id: string; page_slug: string; page_name: string; page_position: number } =>
        !!p.page_slug && !!p.page_name,
    )
    .map((p) => ({ slug: p.page_slug, name: p.page_name }));

  if (style === "raw_html" && typeof content.meta?.raw_html === "string") {
    const applySpeetchDs =
      (content.meta as { apply_speetch_ds?: unknown } | undefined)
        ?.apply_speetch_ds === true;
    return (
      <RawHtmlPageView
        clientSlug={page.client_slug}
        clientName={page.client_name ?? "Espace client"}
        projectSlug={page.project_slug}
        projectName={page.project_name ?? "Projet"}
        pageName={page.page_name ?? "Page"}
        pageSlug={page.page_slug}
        rawHtml={content.meta.raw_html}
        textOverrides={content.meta.text_overrides}
        imageOverrides={content.meta.image_overrides}
        applySpeetchDs={applySpeetchDs}
        pages={navPages}
      />
    );
  }

  if (style === "fwa") {
    return (
      <FwaPageView
        clientSlug={page.client_slug}
        clientName={page.client_name ?? "Espace client"}
        projectSlug={page.project_slug}
        projectName={page.project_name ?? "Projet"}
        projectType={page.project_type}
        pageName={page.page_name ?? "Page"}
        pageSlug={page.page_slug}
        content={content}
        prev={prevTarget}
        next={nextTarget}
        pages={navPages}
      />
    );
  }

  if (style === "document") {
    return (
      <DocumentPageView
        clientSlug={page.client_slug}
        clientName={page.client_name ?? "Espace client"}
        projectSlug={page.project_slug}
        projectName={page.project_name ?? "Projet"}
        projectType={page.project_type}
        pageName={page.page_name ?? "Page"}
        pageSlug={page.page_slug}
        content={content}
        prev={prevTarget}
        next={nextTarget}
        pages={navPages}
      />
    );
  }

  return (
    <PublicPageView
      clientSlug={page.client_slug}
      clientName={page.client_name ?? "Espace client"}
      projectSlug={page.project_slug}
      projectName={page.project_name ?? "Projet"}
      projectType={page.project_type}
      pageName={page.page_name ?? "Page"}
      pageSlug={page.page_slug}
      content={content}
      prev={prevTarget}
      next={nextTarget}
      pages={navPages}
    />
  );
}
