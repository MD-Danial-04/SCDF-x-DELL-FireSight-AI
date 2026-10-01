import { isFireSightRoomScan } from "../../floorplan/firesight";

/**
 * A device-local library of room scans captured on the FireSight iOS app and
 * delivered into the embedded web app. Entries hold the raw
 * `firesight-room-scan/v1` JSON so they stay re-convertible if the floor plan
 * converter improves; thumbnails are derived on demand in the UI.
 */
export interface RoomScanLibraryItem {
  id: string;
  name: string;
  /** Raw firesight-room-scan/v1 JSON payload. */
  json: string;
  /** ISO timestamp the scan was captured (or received, as a fallback). */
  createdAt: string;
}

const STORAGE_KEY = "firesight-room-scan-library";

type Listener = (items: RoomScanLibraryItem[]) => void;

let cache: RoomScanLibraryItem[] | null = null;
const listeners = new Set<Listener>();

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readStorage(): RoomScanLibraryItem[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRoomScanLibraryItem);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function isRoomScanLibraryItem(value: unknown): value is RoomScanLibraryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.json === "string" &&
    typeof item.createdAt === "string"
  );
}

function writeStorage(items: RoomScanLibraryItem[]): void {
  cache = items;
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable — keep the in-memory cache so the current
      // session still works even if persistence fails.
    }
  }
  for (const listener of listeners) listener(items);
}

export function getRoomScanLibrary(): RoomScanLibraryItem[] {
  if (cache === null) cache = readStorage();
  return cache;
}

export function subscribeRoomScanLibrary(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function deriveName(parsed: Record<string, unknown>): string {
  const room = parsed.room;
  if (room && typeof room === "object") {
    const name = (room as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "Room scan";
}

function deriveCreatedAt(parsed: Record<string, unknown>): string {
  const updatedAt = parsed.updatedAt;
  if (typeof updatedAt === "string" && !Number.isNaN(Date.parse(updatedAt))) {
    return updatedAt;
  }
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `scan-${crypto.randomUUID()}`;
  }
  return `scan-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

/**
 * Validate and add a room scan to the library from its raw JSON. Returns the new
 * entry, or throws if the JSON is not a recognizable FireSight room scan.
 */
export function addRoomScanFromJson(json: string): RoomScanLibraryItem {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid room scan JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Expected a room scan JSON object");
  }
  if (!isFireSightRoomScan(parsed)) {
    throw new Error("This file is not a FireSight room scan");
  }

  const record = parsed as Record<string, unknown>;
  const item: RoomScanLibraryItem = {
    id: makeId(),
    name: deriveName(record),
    json,
    createdAt: deriveCreatedAt(record),
  };

  writeStorage([item, ...getRoomScanLibrary()]);
  return item;
}

export function removeRoomScan(id: string): void {
  writeStorage(getRoomScanLibrary().filter((item) => item.id !== id));
}
