import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, Eyebrow, Hairline } from "@/lib/ds";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Double-garde côté serveur (le middleware redirige déjà mais belt-and-suspenders).
  if (!user) {
    redirect("/login?redirect=/admin");
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  const isOwner = ownerEmail
    ? user.email?.toLowerCase() === ownerEmail
    : true;

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      {/* Header — mobile only (la sidebar prend le relai en desktop) */}
      <header className="flex items-center justify-between md:hidden">
        <Button href="/" variant="return">
          Speetch
        </Button>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
          >
            <span>Déconnexion</span>
            <Hairline />
          </button>
        </form>
      </header>

      {/* Centre */}
      <section className="mx-auto flex max-w-4xl flex-col items-start gap-12 pt-24 md:pt-20">
        <Eyebrow tracking="lg" intensity="muted">Administration</Eyebrow>

        <h1
          className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
        >
          Bienvenue,{" "}
          <span className="font-serif italic font-normal text-white/85">
            {user.email?.split("@")[0]}
          </span>
        </h1>

        <div className="flex flex-col gap-3 text-[11px] uppercase tracking-[0.32em] text-white/45">
          <div className="flex items-center gap-3">
            <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Session active
          </div>
          <div>{user.email}</div>
          {!isOwner && (
            <div className="text-amber-300/80">
              Compte non propriétaire — fonctionnalités admin restreintes
            </div>
          )}
        </div>

        <div className="mt-12 w-full border-t border-white/10 pt-12">
          <Eyebrow intensity="muted">Espaces clients</Eyebrow>

          <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-6">
            <Button href="/admin/clients/new" variant="large">
              Créer un nouvel espace
            </Button>
            <Button href="/admin/clients" variant="primary">
              Liste des espaces
            </Button>
          </div>

          <ul className="mt-12 flex flex-col gap-3 text-base text-white/45 md:text-lg">
            <li>· Génération automatique de slug unique</li>
            <li>· Mot de passe scrypt + pepper</li>
            <li>· Lien à transmettre une seule fois</li>
          </ul>
        </div>

        <div className="mt-12 w-full border-t border-white/10 pt-12">
          <Eyebrow intensity="muted">Réglages</Eyebrow>

          <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-6">
            <Button href="/admin/settings" variant="large">
              Ouvrir les Réglages
            </Button>
            <Button href="/admin/settings/profile" variant="primary">
              Mon profil
            </Button>
            <Button href="/admin/templates" variant="primary">
              Templates
            </Button>
          </div>

          <ul className="mt-12 flex flex-col gap-3 text-base text-white/45 md:text-lg">
            <li>· Profil owner (nom affiché, avatar)</li>
            <li>· Templates HTML personnalisés (Claude API)</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="absolute inset-x-0 bottom-0 flex items-end justify-between px-6 py-6 text-[11px] uppercase tracking-[0.28em] text-white/40 md:px-12">
        <span>Paris · 2026</span>
        <span>Speetch — Admin</span>
      </footer>
    </div>
  );
}
