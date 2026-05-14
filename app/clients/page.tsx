import type { Metadata } from "next";
import { SlugForm } from "./slug-form";

export const metadata: Metadata = {
  title: "Accéder à mon espace · Speetch",
  description:
    "Saisis le nom de ton espace client Speetch pour y accéder.",
  robots: { index: false, follow: false },
};

export default function ClientsAccessPage() {
  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-12 pt-20 md:pt-28">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">
          Accès
        </p>

        <h1
          className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
        >
          Ton{" "}
          <span className="font-serif italic font-normal text-white/85">
            espace
          </span>
          ,{" "}
          <span className="block md:inline">à toi seul.</span>
        </h1>

        <p className="max-w-xl text-balance font-serif text-base italic text-white/55 md:text-lg">
          Indique le nom de ton espace pour l&apos;ouvrir. Il t&apos;a été
          transmis par e-mail à la création.
        </p>

        <SlugForm />
      </section>

      <footer className="absolute inset-x-0 bottom-0 flex items-end justify-between px-6 py-6 text-[11px] uppercase tracking-[0.28em] text-white/40 md:px-12">
        <span>Paris · 2026</span>
        <span>Speetch — Espaces clients</span>
      </footer>
    </div>
  );
}
