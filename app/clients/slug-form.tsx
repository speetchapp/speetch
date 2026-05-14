"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button, Field } from "@/lib/ds";
import { isValidSlug } from "@/lib/slug";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function SlugForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setError("Indique le nom de ton espace.");
      return;
    }
    if (!isValidSlug(trimmed)) {
      setError(
        "Slug invalide. Lettres, chiffres et tirets uniquement (ex : atelier-lea-muller).",
      );
      return;
    }
    setPending(true);
    router.push(`/clients/${trimmed}`);
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.45, ease: EASE_OUT_EXPO }}
      className="flex w-full max-w-2xl flex-col gap-10"
    >
      <Field label="Nom de l'espace" hint="reçu par e-mail">
        <input
          type="text"
          name="slug"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          placeholder="atelier-lea-muller"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border-b border-white/20 bg-transparent pb-3 font-mono text-xl text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none md:text-2xl"
        />
      </Field>

      {error && (
        <motion.p
          key={error}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          className="text-[11px] uppercase tracking-[0.32em] text-red-300/80"
        >
          {error}
        </motion.p>
      )}

      <div className="flex items-center justify-end border-t border-white/10 pt-6">
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel="Ouverture…"
        >
          Accéder à mon espace
        </Button>
      </div>
    </motion.form>
  );
}
