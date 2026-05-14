import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Button, Eyebrow, Hairline } from "@/lib/ds";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SettingsHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/settings");
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const [{ count: templateCount }, { data: ownerProfile }] = await Promise.all([
    admin
      .from("page_templates")
      .select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("is_owner", true)
      .maybeSingle(),
  ]);

  const cards = [
    {
      href: "/admin/settings/profile",
      label: "Mon profil",
      hint: ownerProfile?.full_name
        ? ownerProfile.full_name
        : "Configurer ton identité Speetch",
      summary: "Nom affiché, avatar, identité owner.",
    },
    {
      href: "/admin/settings/design-system",
      label: "Design System",
      hint: "Charte Speetch",
      summary:
        "Palette, typographies, easings, principes — référence visuelle pour les espaces clients.",
    },
    {
      href: "/admin/templates",
      label: "Templates",
      hint:
        templateCount && templateCount > 0
          ? `${templateCount} template${templateCount > 1 ? "s" : ""} HTML`
          : "Aucun template personnalisé",
      summary:
        "Gérer les templates de page personnalisés (uploads HTML, conversion Claude).",
    },
  ];

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      {/* Header — mobile only */}
      <header className="flex items-center justify-between md:hidden">
        <Button href="/admin" variant="return">
          Admin
        </Button>
        <Eyebrow intensity="muted" tracking="sm">
          Réglages
        </Eyebrow>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col gap-12 pt-20">
        <div className="flex flex-col gap-6">
          <Eyebrow tracking="lg" intensity="muted" as="p">
            <Link href="/admin" className="transition-colors hover:text-white">
              Administration
            </Link>
            <span className="mx-3 text-white/20">→</span>
            <span className="text-white/55">Réglages</span>
          </Eyebrow>

          <h1
            className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
          >
            Réglages
          </h1>

          <p className="max-w-xl text-balance font-serif text-base italic text-white/45 md:text-lg">
            Configuration de l&apos;administration Speetch. Identité du
            propriétaire, templates de page et paramètres avancés.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/[0.08] md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="group relative flex h-full flex-col gap-6 bg-black p-7 transition-colors duration-500 ease-out hover:bg-white/[0.03] md:p-9"
              >
                <Eyebrow
                  tracking="lg"
                  intensity="muted"
                  className="text-[10px] text-white/30 transition-colors duration-500 group-hover:text-white/55"
                >
                  Sous-rubrique
                </Eyebrow>

                <h2
                  className="font-sans font-extralight leading-[0.95] tracking-[-0.03em] text-[#F5F5F7]"
                  style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)" }}
                >
                  {card.label}
                </h2>

                <Eyebrow tracking="sm" intensity="default">
                  {card.hint}
                </Eyebrow>

                <p className="font-serif text-sm italic text-white/55 transition-colors duration-500 group-hover:text-white/75 md:text-base">
                  {card.summary}
                </p>

                <span className="mt-auto inline-flex items-center gap-3 pt-4 text-[10px] uppercase tracking-[0.32em] text-white/40 transition-colors duration-500 group-hover:text-white">
                  <Hairline width="sm" hover="xl" />
                  <span>Ouvrir</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center pt-4">
          <Button href="/admin" variant="ghost">
            ← Tableau de bord
          </Button>
        </div>
      </section>
    </div>
  );
}
