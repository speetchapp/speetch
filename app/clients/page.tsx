import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Eyebrow } from "@/lib/ds";

export const metadata: Metadata = {
  title: "Clients · Speetch",
  description:
    "Une sélection de marques accompagnées. Quinze ans de directions artistiques pour la presse, le luxe, la grande distribution et le service public.",
};

type Brand = { name: string; slug: string };

async function loadBrands(): Promise<Array<Brand & { svg: string }>> {
  const dir = path.join(process.cwd(), "public", "brands");
  const manifest: Brand[] = JSON.parse(
    await fs.readFile(path.join(dir, "_manifest.json"), "utf-8"),
  );
  return Promise.all(
    manifest.map(async (b) => ({
      ...b,
      svg: await fs.readFile(path.join(dir, `${b.slug}.svg`), "utf-8"),
    })),
  );
}

export default async function ClientsPage() {
  const brands = await loadBrands();

  return (
    <div className="relative flex min-h-svh w-full flex-col px-6 py-8 md:px-16 md:py-12">
      {/* En-tête : numéro de section + signature */}
      <header className="flex items-baseline justify-between border-t border-white/10 pt-6 md:pt-8">
        <Eyebrow tracking="lg" intensity="muted">
          01 · Clients
        </Eyebrow>
        <Eyebrow tracking="md" intensity="muted">
          Speetch
        </Eyebrow>
      </header>

      {/* Hero monumental */}
      <section className="flex flex-col gap-10 py-16 md:gap-16 md:py-28">
        <h1
          className="font-sans font-extralight leading-[0.85] tracking-[-0.06em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(3.5rem, 14vw, 12rem)" }}
        >
          <span className="block">Une sélection</span>
          <span className="block pl-[0.3em] text-white/85">de marques</span>
          <span className="block pl-[0.7em] font-serif italic font-normal text-white/65">
            — {brands.length}.
          </span>
        </h1>

        <p className="max-w-2xl text-balance font-serif text-base italic text-white/55 md:text-lg">
          Quinze ans de directions artistiques aux côtés de la presse, du
          luxe, de la grande distribution, du service public et des médias.
        </p>
      </section>

      {/* Grille logos */}
      <section className="border-t border-white/10 py-8 md:py-12">
        <ul className="grid grid-cols-2 gap-px overflow-hidden bg-white/[0.06] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {brands.map((b) => (
            <li
              key={b.slug}
              title={b.name}
              className="group relative flex aspect-[3/2] items-center justify-center bg-black p-6 text-white/45 transition-colors duration-700 hover:text-white md:p-8 [&>svg]:h-auto [&>svg]:w-auto [&>svg]:max-h-[55%] [&>svg]:max-w-[70%]"
              dangerouslySetInnerHTML={{ __html: b.svg }}
            />
          ))}
        </ul>
      </section>

      {/* Footer */}
      <footer className="mt-12 flex items-end justify-between border-t border-white/10 pt-6 md:mt-20">
        <Eyebrow tracking="sm" intensity="muted">
          Paris · 2026
        </Eyebrow>
        <Eyebrow tracking="sm" intensity="muted">
          Speetch — Studio
        </Eyebrow>
      </footer>
    </div>
  );
}
