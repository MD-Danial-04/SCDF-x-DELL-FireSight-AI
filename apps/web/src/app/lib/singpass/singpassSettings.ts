import { useSyncExternalStore } from "react";
import { SINGPASS_PERSONAS } from "../../constants/singpassPersonas";

const STORAGE_KEY = "firesight.singpass.activePersonaId";

const defaultPersonaId = (): string => SINGPASS_PERSONAS[0]?.id ?? "";

const listeners = new Set<() => void>();

function readPersonaId(): string {
  if (typeof window === "undefined") {
    return defaultPersonaId();
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SINGPASS_PERSONAS.some((p) => p.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors (private mode, etc.).
  }
  return defaultPersonaId();
}

export function getActivePersonaId(): string {
  return readPersonaId();
}

export function setActivePersonaId(personaId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, personaId);
  } catch {
    // Ignore storage access errors.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook returning the active demo persona id, reactive to changes. */
export function useActivePersonaId(): string {
  return useSyncExternalStore(subscribe, readPersonaId, defaultPersonaId);
}
