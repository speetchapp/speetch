import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative min-h-svh w-full">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 md:px-12">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors duration-300 hover:text-white"
        >
          <span className="inline-block h-px w-6 bg-current transition-all duration-500 ease-out group-hover:w-10" />
          Retour Speetch
        </Link>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          404
        </span>
      </header>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-6 text-[11px] uppercase tracking-[0.4em] text-white/40">
          Introuvable
        </p>
        <h1
          className="select-none font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(3rem, 12vw, 9rem)" }}
        >
          Espace{" "}
          <span className="font-serif italic font-normal text-white/85">
            inexistant
          </span>
        </h1>
        <p className="mt-10 max-w-md text-balance font-serif text-base italic text-white/40 md:text-lg">
          Cet espace client n&apos;existe pas, n&apos;est plus publié, ou le
          lien que tu as reçu est incorrect.
        </p>
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-6 py-6 text-[11px] uppercase tracking-[0.28em] text-white/40 md:px-12">
        <span>Paris · 2026</span>
        <span>Speetch</span>
      </footer>
    </div>
  );
}
