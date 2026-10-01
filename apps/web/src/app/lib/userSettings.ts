import { useSyncExternalStore } from "react";

const PROFILE_KEY = "firesight.user.nameRankAppointment";
const STATION_KEY = "firesight.user.station";

const listeners = new Set<() => void>();

function readKey(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    // Ignore storage access errors (private mode, etc.).
    return "";
  }
}

function writeKey(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage access errors.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The officer's saved "Name / Rank / Appointment" string used to prefill reports. */
export function getOfficerProfile(): string {
  return readKey(PROFILE_KEY);
}

export function setOfficerProfile(value: string): void {
  writeKey(PROFILE_KEY, value);
}

/** The officer's saved station used to prefill the report's Station field. */
export function getOfficerStation(): string {
  return readKey(STATION_KEY);
}

export function setOfficerStation(value: string): void {
  writeKey(STATION_KEY, value);
}

/** React hook returning the saved officer profile, reactive to changes. */
export function useOfficerProfile(): string {
  return useSyncExternalStore(
    subscribe,
    () => readKey(PROFILE_KEY),
    () => ""
  );
}

/** React hook returning the saved station, reactive to changes. */
export function useOfficerStation(): string {
  return useSyncExternalStore(
    subscribe,
    () => readKey(STATION_KEY),
    () => ""
  );
}
