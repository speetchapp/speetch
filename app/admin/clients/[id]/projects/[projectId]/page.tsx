import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getProjectTypeLabel } from "@/lib/project-types";
import {
  CUSTOM_TEMPLATE_ID,
  RAW_HTML_VIRTUAL_TEMPLATE_ID,
  getPageTemplate,
  isDbTemplateId,
} from "@/lib/page-templates";
import { Button, Chip, Eyebrow, Hairline, StatusBadge } from "@/lib/ds";
import { DetachPageButton } from "./_components/detach-page-button";

export const metadata: Metadata = {
  title: "Projet · Pages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageRow = {
  id: string;
  name: string;
  slug: string;
  template_id: string;
  position: number;
  is_published: boolean;
  created_at: string;
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;

  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(projectId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/admin/clients/${id}/projects/${projectId}`);
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    redirect("/admin");
  }

  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select(
      "id, name, subtitle, project_type, is_published, profile_id, profiles(full_name, slug)",
    )
    .eq("id", projectId)
    .eq("profile_id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: pagesData } = await admin
    .from("pages")
    .select("id, name, slug, template_id, position, is_published, created_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const pages: PageRow[] = (pagesData ?? []) as PageRow[];
  const publishedCount = pages.filter((p) => p.is_published).length;

  // Batch-fetch les labels des templates DB référencés
  const dbTemplateIds = Array.from(
    new Set(pages.map((p) => p.template_id).filter(isDbTemplateId)),
  );
  const dbTemplateLabels = new Map<string, string>();
  if (dbTemplateIds.length > 0) {
    const { data: tpls } = await admin
      .from("page_templates")
      .select("id, label")
      .in("id", dbTemplateIds);
    for (const tpl of tpls ?? []) {
      dbTemplateLabels.set(tpl.id, tpl.label);
    }
  }
  const clientName =
    (project.profiles as { full_name: string | null } | null)?.full_name ??
    "Client";
  const typeLabel = getProjectTypeLabel(project.project_type);

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      {/* Header — mobile only */}
      <header className="flex items-center justify-between md:hidden">
        <Link
          href="/admin/clients"
          className="text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors hover:text-white"
        >
          ← Clients
        </Link>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          Projet
        </span>
      </header>

      <section className="mx-auto flex max-w-4xl flex-col gap-12 pt-20">
        <div className="flex flex-col gap-6">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">
            <Link
              href="/admin/clients"
              className="transition-colors hover:text-white"
            >
              Espaces clients
            </Link>
            <span className="mx-3 text-white/20">→</span>
            <span className="text-white/55">{clientName}</span>
            {typeLabel && (
              <>
                <span className="mx-3 text-white/20">·</span>
                <span className="text-white/55">{typeLabel}</span>
              </>
            )}
          </p>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <h1
                  className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
                  style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
                >
                  {project.name}
                </h1>
                {project.is_published ? (
                  <StatusBadge tone="success">Publié</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Brouillon</StatusBadge>
                )}
              </div>
              {project.subtitle && (
                <p className="max-w-xl text-balance font-serif text-base italic text-white/45 md:text-lg">
                  {project.subtitle}
                </p>
              )}
            </div>

            <Button
              href={`/admin/clients/${id}/projects/${projectId}/pages/new`}
              variant="primary"
            >
              + Nouvelle page
            </Button>
          </div>

          <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">
            {pages.length === 0
              ? "Aucune page pour le moment"
              : `${pages.length} page${pages.length > 1 ? "s" : ""} · ${publishedCount} publiée${publishedCount > 1 ? "s" : ""}`}
          </p>
        </div>

        {pages.length === 0 ? (
          <EmptyState clientId={id} projectId={projectId} />
        ) : (
          <ul className="flex flex-col border-t border-white/10">
            {pages.map((page) => {
              const codeTemplate = getPageTemplate(page.template_id);
              const dbLabel = dbTemplateLabels.get(page.template_id);
              const isDetached = page.template_id === CUSTOM_TEMPLATE_ID;
              const isRawHtmlDirect =
                page.template_id === RAW_HTML_VIRTUAL_TEMPLATE_ID;
              const templateLabel = isDetached
                ? "Détachée"
                : isRawHtmlDirect
                  ? "Reproduction fidèle"
                  : (codeTemplate?.label ?? dbLabel ?? null);
              const formattedDate = new Date(
                page.created_at,
              ).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <li
                  key={page.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-b border-white/10 py-7"
                >
                  <Link
                    href={`/admin/clients/${id}/projects/${projectId}/pages/${page.id}`}
                    className="group flex min-w-0 flex-1 flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                      <h2 className="text-2xl font-light text-white/80 transition-colors group-hover:text-[#F5F5F7] md:text-3xl">
                        {page.name}
                      </h2>
                      {page.is_published ? (
                        <StatusBadge tone="success">Publiée</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Brouillon</StatusBadge>
                      )}
                    </div>
                    {templateLabel && (
                      <Chip
                        tone={
                          isDetached
                            ? "muted"
                            : isRawHtmlDirect
                              ? "warning"
                              : "default"
                        }
                        className="w-fit"
                      >
                        {templateLabel}
                        {dbLabel && !isDetached && !isRawHtmlDirect && (
                          <span className="ml-2 text-white/35">· HTML</span>
                        )}
                      </Chip>
                    )}
                    <p className="font-mono text-[11px] text-white/35">
                      <span>/{page.slug}</span>
                      <span className="text-white/20"> · </span>
                      <span>{formattedDate}</span>
                    </p>
                  </Link>

                  <div className="flex shrink-0 items-center gap-6">
                    {!isDetached && !isRawHtmlDirect && (
                      <DetachPageButton
                        profileId={id}
                        projectId={projectId}
                        pageId={page.id}
                        pageName={page.name}
                      />
                    )}
                    <Link
                      href={`/admin/clients/${id}/projects/${projectId}/pages/${page.id}`}
                      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
                    >
                      <span>Éditer</span>
                      <Hairline width="sm" hover="lg" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center pt-4">
          <Button href="/admin/clients" variant="ghost">
            ← Retour clients
          </Button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  clientId,
  projectId,
}: {
  clientId: string;
  projectId: string;
}) {
  return (
    <div className="flex flex-col items-start gap-8 border-t border-white/10 pt-16">
      <p className="max-w-md text-balance font-serif text-base italic text-white/40 md:text-lg">
        Ce projet n&apos;a encore aucune page. Démarre avec un template pour
        poser une première mise en forme.
      </p>
      <Button
        href={`/admin/clients/${clientId}/projects/${projectId}/pages/new`}
        variant="large"
      >
        Créer la première page
      </Button>
    </div>
  );
}
