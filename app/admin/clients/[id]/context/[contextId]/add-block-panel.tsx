"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  Button,
  Field,
  Modal,
} from "@/lib/ds";
import { appendContextBlock, uploadContextImage } from "../actions";

type BlockType = "title" | "text" | "image" | "code";

/**
 * Panneau "Ajouter un bloc" intégré à la toolbar du raw-html viewer.
 * Affiche un dropdown avec 4 choix de blocs. Chaque choix ouvre une modale
 * dédiée pour saisir les paramètres, puis appelle appendContextBlock pour
 * persister.
 *
 * Pour les images : upload séparé (uploadContextImage) qui renvoie l'URL,
 * puis appendContextBlock avec l'URL retournée.
 */
export function AddBlockPanel({
  profileId,
  contextId,
}: {
  profileId: string;
  contextId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<BlockType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function openBlock(type: BlockType) {
    setMenuOpen(false);
    setActiveBlock(type);
  }

  function closeBlock() {
    if (!pending) setActiveBlock(null);
  }

  function submit(args: {
    block: Parameters<typeof appendContextBlock>[0]["block"];
  }) {
    setError(null);
    startTransition(async () => {
      const result = await appendContextBlock({
        profileId,
        contextId,
        block: args.block,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setActiveBlock(null);
      router.refresh();
    });
  }

  async function submitImage(args: {
    file: File;
    alt: string;
    caption: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const form = new FormData();
    form.append("profile_id", profileId);
    form.append("context_id", contextId);
    form.append("file", args.file);
    const uploadResult = await uploadContextImage(form);
    if (!uploadResult.ok) {
      return { ok: false, error: uploadResult.error };
    }
    const result = await appendContextBlock({
      profileId,
      contextId,
      block: {
        type: "image",
        url: uploadResult.url,
        alt: args.alt,
        caption: args.caption || null,
      },
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          onClick={() => setMenuOpen((v) => !v)}
          variant="ghost"
          disabled={pending}
        >
          + Ajouter un bloc
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col overflow-hidden rounded-xl border border-white/15 bg-black/90 py-1 shadow-xl backdrop-blur">
            <MenuItem
              label="Titre"
              hint="H2 ou H3"
              onClick={() => openBlock("title")}
            />
            <MenuItem
              label="Texte"
              hint="Paragraphes"
              onClick={() => openBlock("text")}
            />
            <MenuItem
              label="Image"
              hint="Upload + alt + caption"
              onClick={() => openBlock("image")}
            />
            <MenuItem
              label="Bloc de code"
              hint="<pre><code>…"
              onClick={() => openBlock("code")}
            />
          </div>
        )}
      </div>

      {activeBlock === "title" && (
        <TitleBlockModal
          pending={pending}
          onCancel={closeBlock}
          onSubmit={(text, level) =>
            submit({ block: { type: "title", text, level } })
          }
        />
      )}
      {activeBlock === "text" && (
        <TextBlockModal
          pending={pending}
          onCancel={closeBlock}
          onSubmit={(text) => submit({ block: { type: "text", text } })}
        />
      )}
      {activeBlock === "code" && (
        <CodeBlockModal
          pending={pending}
          onCancel={closeBlock}
          onSubmit={(code, language) =>
            submit({
              block: { type: "code", code, language: language || null },
            })
          }
        />
      )}
      {activeBlock === "image" && (
        <ImageBlockModal
          pending={pending}
          onCancel={closeBlock}
          onSubmit={async (file, alt, caption) => {
            const result = await submitImage({ file, alt, caption });
            if (result.ok) {
              setActiveBlock(null);
              router.refresh();
            } else {
              setError(result.error ?? "Erreur lors de l'upload.");
            }
          }}
        />
      )}

      <AlertDialog
        open={error !== null}
        title="Action impossible"
        description={error}
        onClose={() => setError(null)}
      />
    </>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.08]"
    >
      <span className="font-sans text-sm font-light text-[#F5F5F7]">
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        {hint}
      </span>
    </button>
  );
}

// ---------- Modales par type de bloc ----------

function TitleBlockModal({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (text: string, level: 2 | 3) => void;
}) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<2 | 3>(2);
  const canSubmit = text.trim().length > 0;

  return (
    <Modal open={true} size="compact" onClose={pending ? () => {} : onCancel}>
      <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">
          Ajouter un titre
        </p>
        <h2
          className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
        >
          Nouveau titre
        </h2>
        <Field label="Niveau">
          <div className="flex gap-3">
            {([2, 3] as const).map((lv) => {
              const active = lv === level;
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`flex-1 rounded-md border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-white/40 bg-white/[0.06] text-[#F5F5F7]"
                      : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-[0.32em] text-white/45">
                    H{lv}
                  </span>
                  <span className="block font-sans font-light">
                    {lv === 2 ? "Titre principal" : "Sous-titre"}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Texte">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            placeholder="Mon nouveau titre"
            className="border-b border-white/20 bg-transparent pb-3 font-sans text-xl font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
          />
        </Field>
        <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(text.trim(), level)}
            disabled={pending || !canSubmit}
          >
            {pending ? "Ajout…" : "Ajouter le titre"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TextBlockModal({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0;
  return (
    <Modal open={true} size="compact" onClose={pending ? () => {} : onCancel}>
      <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">
          Ajouter un texte
        </p>
        <h2
          className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
        >
          Nouveau bloc texte
        </h2>
        <Field label="Contenu" hint="Sépare les paragraphes par une ligne vide">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={8}
            placeholder="Premier paragraphe…\n\nDeuxième paragraphe…"
            className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] p-4 font-serif text-base text-[#F5F5F7]/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none"
          />
        </Field>
        <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(text)}
            disabled={pending || !canSubmit}
          >
            {pending ? "Ajout…" : "Ajouter le texte"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CodeBlockModal({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (code: string, language: string) => void;
}) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("");
  const canSubmit = code.trim().length > 0;
  return (
    <Modal open={true} size="panel" onClose={pending ? () => {} : onCancel}>
      <div className="flex h-full max-h-[85vh] flex-col gap-5 px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/55">
            Ajouter un bloc de code
          </p>
          <h2
            className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
          >
            Nouveau bloc de code
          </h2>
        </div>
        <Field label="Langage" hint="optionnel — ex. javascript, css, html…">
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="javascript"
            className="border-b border-white/20 bg-transparent pb-3 font-mono text-base text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
          />
        </Field>
        <Field label="Code">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            spellCheck={false}
            className="min-h-[260px] w-full resize-y rounded-md border border-white/10 bg-black/60 p-4 font-mono text-[12px] leading-relaxed text-white/85 focus:border-white/40 focus:outline-none"
          />
        </Field>
        <div className="mt-auto flex items-center justify-end gap-6 border-t border-white/10 pt-5">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(code, language.trim())}
            disabled={pending || !canSubmit}
          >
            {pending ? "Ajout…" : "Ajouter le code"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImageBlockModal({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (file: File, alt: string, caption: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const canSubmit = file !== null && alt.trim().length > 0;
  return (
    <Modal open={true} size="compact" onClose={pending ? () => {} : onCancel}>
      <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">
          Ajouter une image
        </p>
        <h2
          className="font-sans font-extralight leading-tight tracking-[-0.03em] text-[#F5F5F7]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}
        >
          Nouvelle image
        </h2>
        <Field label="Fichier" hint="png, jpeg, webp, gif, svg · max 8 MB">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-white/70 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.32em] file:text-white/80 hover:file:bg-white/20"
          />
        </Field>
        <Field label="Texte alternatif" hint="requis — accessibilité">
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Description de l'image"
            className="border-b border-white/20 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
          />
        </Field>
        <Field label="Légende" hint="optionnel">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Affichée en italique sous l'image"
            className="border-b border-white/20 bg-transparent pb-3 font-serif text-base italic text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
          />
        </Field>
        <div className="mt-2 flex items-center justify-end gap-6 border-t border-white/10 pt-6">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => file && onSubmit(file, alt.trim(), caption.trim())}
            disabled={pending || !canSubmit}
          >
            {pending ? "Upload…" : "Ajouter l'image"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
