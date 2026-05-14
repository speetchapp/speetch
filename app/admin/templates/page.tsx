import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getProjectTypeLabel } from "@/lib/project-types";
import { Button, Chip, Eyebrow, Hairline } from "@/lib/ds";
import { DeleteTemplateForm } from "./delete-button";

export const metadata: Metadata = {
  title: "Templates de page",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TemplatesListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/templates");
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const { data: templates } = await admin
    .from("page_templates")
    .select("id, label, tagline, description, project_type, created_at, default_content")
    .order("created_at", { ascending: false });

  const list = templates ?? [];

  // Compte d'usage : combien de pages référencent chaque template.id ?
  // Une seule requête, on group côté JS.
  const usageById = new Map<string, number>();
  if (list.length > 0) {
    const { data: usageRows } = await admin
      .from("pages")
      .select("template_id")
      .in(
        "template_id",
        list.map((t) => t.id),
      );
    for (const row of usageRows ?? []) {
      usageById.set(row.template_id, (usageById.get(row.template_id) ?? 0) + 1);
    }
  }

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      <header className="flex items-center justify-between md:hidden">
        <Link
          href="/admin/settings"
          className="text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors hover:text-white"
        >
          ← Réglages
        </Link>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          Templates
        </span>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col gap-12 pt-20">
        <div className="flex flex-col gap-6">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">
            <Link href="/admin" className="transition-colors hover:text-white">
              Administration
            </Link>
            <span className="mx-3 text-white/20">→</span>
            <Link
              href="/admin/settings"
              className="transition-colors hover:text-white"
            >
              Réglages
            </Link>
            <span className="mx-3 text-white/20">→</span>
            <span className="text-white/55">Templates</span>
          </p>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <h1
              className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
              style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
            >
              Templates{" "}
              <span className="font-serif italic font-normal text-white/85">
                de page
              </span>
            </h1>

            <Button href="/admin/templates/new" variant="primary">
              + Importer du HTML
            </Button>
          </div>

          <p className="max-w-xl text-balance font-serif text-base italic text-white/45 md:text-lg">
            Upload une page HTML, Claude la transforme en template éditable.
            Les templates peuvent être généraux ou liés à un type de projet
            précis.
          </p>

          <Eyebrow tracking="md" intensity="default">
            {list.length === 0
              ? "Aucun template personnalisé"
              : `${list.length} template${list.length > 1 ? "s" : ""} personnalisé${list.length > 1 ? "s" : ""}`}
          </Eyebrow>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-start gap-8 border-t border-white/10 pt-16">
            <p className="max-w-md text-balance font-serif text-base italic text-white/40 md:text-lg">
              Aucun template personnalisé en BDD. Les 5 presets code (page
              blanche, présentation, moodboard, livrable, process) restent
              toujours disponibles à la création.
            </p>
            <Button href="/admin/templates/new" variant="large">
              Importer le premier HTML
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col border-t border-white/10">
            {list.map((tpl) => {
              const formattedDate = new Date(tpl.created_at).toLocaleDateString(
                "fr-FR",
                { year: "numeric", month: "short", day: "numeric" },
              );
              const typeLabel = getProjectTypeLabel(tpl.project_type);
              const usageCount = usageById.get(tpl.id) ?? 0;
              const tplStyle =
                (tpl.default_content as { meta?: { style?: string } } | null)
                  ?.meta?.style ?? "document";
              const isRawHtml = tplStyle === "raw_html";
              return (
                <li
                  key={tpl.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-b border-white/10 py-7"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                      <h2 className="text-2xl font-light text-[#F5F5F7] md:text-3xl">
                        {tpl.label}
                      </h2>
                      {typeLabel ? (
                        <Chip tone="default">{typeLabel}</Chip>
                      ) : (
                        <Chip tone="muted">Tous types</Chip>
                      )}
                      <Chip tone={isRawHtml ? "warning" : "muted"}>
                        {isRawHtml ? "Reproduction fidèle" : "Édition libre"}
                      </Chip>
                    </div>
                    {tpl.tagline && (
                      <p className="font-serif text-sm italic text-white/55 md:text-base">
                        {tpl.tagline}
                      </p>
                    )}
                    {tpl.description && (
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                        {tpl.description}
                      </p>
                    )}
                    <p className="font-mono text-[11px] text-white/35">
                      <span>{formattedDate}</span>
                      <span className="text-white/20"> · </span>
                      <span>
                        {(
                          ((tpl.default_content as { sections?: unknown[] }).sections ?? [])
                            .length
                        )}{" "}
                        section(s)
                      </span>
                      <span className="text-white/20"> · </span>
                      <span>
                        {usageCount === 0
                          ? "non utilisé"
                          : `${usageCount} page${usageCount > 1 ? "s" : ""}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-6">
                    <Link
                      href={`/admin/templates/${tpl.id}`}
                      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
                    >
                      <span>Éditer</span>
                      <Hairline width="sm" hover="lg" />
                    </Link>
                    <DeleteTemplateForm
                      templateId={tpl.id}
                      usageCount={usageCount}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center pt-4">
          <Button href="/admin/settings" variant="ghost">
            ← Retour Réglages
          </Button>
        </div>
      </section>
    </div>
  );
}
