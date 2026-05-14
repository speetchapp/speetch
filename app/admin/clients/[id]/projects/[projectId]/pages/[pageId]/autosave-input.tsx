"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveResult = { ok: true } | { ok: false; error: string };

type CommonProps = {
  initialValue: string;
  onSave: (value: string) => Promise<AutosaveResult>;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  debounceMs?: number;
};

type InputProps = CommonProps & {
  multiline?: false;
};

type TextareaProps = CommonProps & {
  multiline: true;
  rows?: number;
};

/**
 * Champ texte ou textarea avec auto-save débouncé.
 *
 * - Met à jour la valeur locale immédiatement (pas de lag clavier)
 * - Déclenche `onSave` après `debounceMs` ms d'inactivité
 * - Affiche une erreur inline si la sauvegarde échoue
 * - Se re-synchronise si `initialValue` change côté parent
 */
export function AutosaveField(props: InputProps | TextareaProps) {
  const {
    initialValue,
    onSave,
    placeholder,
    className = "",
    ariaLabel,
    debounceMs = 600,
  } = props;

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialValue !== lastSavedRef.current) {
      lastSavedRef.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(newValue: string) {
    setValue(newValue);
    setError(null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (newValue === lastSavedRef.current) return;

    timeoutRef.current = setTimeout(async () => {
      const result = await onSave(newValue);
      if (result.ok) {
        lastSavedRef.current = newValue;
      } else {
        setError(result.error);
      }
    }, debounceMs);
  }

  const sharedProps = {
    value,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => handleChange(e.target.value),
    placeholder,
    "aria-label": ariaLabel,
    className,
  };

  return (
    <div className="flex flex-col gap-1">
      {props.multiline ? (
        <textarea {...sharedProps} rows={props.rows ?? 4} />
      ) : (
        <input {...sharedProps} type="text" autoComplete="off" />
      )}
      {error && (
        <p className="text-[10px] uppercase tracking-[0.32em] text-red-300/80">
          {error}
        </p>
      )}
    </div>
  );
}
