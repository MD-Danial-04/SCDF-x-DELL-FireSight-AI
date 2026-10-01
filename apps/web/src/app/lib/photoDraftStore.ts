import type { PhotoLogEntry } from "../types/photoLog";

const DB_NAME = "firesight-incident-drafts";
const DB_VERSION = 1;
const STORE_NAME = "photos";

/**
 * Device-local persistence for photo-log entries (binary blobs).
 *
 * Photos are intentionally kept on the device only and are NOT synced to the
 * cloud incident draft. Records are keyed by incident number; each entry stores
 * the photo blob plus its serializable metadata.
 */

interface StoredPhotoRecord {
  /** Composite primary key: `${incidentNo}::${photo.id}`. */
  key: string;
  incidentNo: string;
  order: number;
  photo: SerializablePhoto;
}

type SerializablePhoto = Omit<PhotoLogEntry, "blob"> & { blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("incidentNo", "incidentNo", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function buildKey(incidentNo: string, photoId: string): string {
  return `${incidentNo}::${photoId}`;
}

/** Replace all stored photos for an incident with the provided list (in order). */
export async function savePhotos(incidentNo: string, photos: PhotoLogEntry[]): Promise<void> {
  if (!incidentNo) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("incidentNo");

      const cursorRequest = index.openCursor(IDBKeyRange.only(incidentNo));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }
        photos.forEach((photo, order) => {
          const record: StoredPhotoRecord = {
            key: buildKey(incidentNo, photo.id),
            incidentNo,
            order,
            photo,
          };
          store.put(record);
        });
      };
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("Failed to clear photos."));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save photos."));
      tx.onabort = () => reject(tx.error ?? new Error("Photo save transaction aborted."));
    });
  } finally {
    db.close();
  }
}

/** Load all stored photos for an incident, restored in their saved order. */
export async function loadPhotos(incidentNo: string): Promise<PhotoLogEntry[]> {
  if (!incidentNo) return [];
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("incidentNo");
    const records = await promisifyRequest(index.getAll(IDBKeyRange.only(incidentNo)));
    return (records as StoredPhotoRecord[])
      .sort((a, b) => a.order - b.order)
      .map((record) => record.photo as PhotoLogEntry);
  } finally {
    db.close();
  }
}

/** Delete all stored photos for an incident. */
export async function deletePhotos(incidentNo: string): Promise<void> {
  if (!incidentNo) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("incidentNo");
      const cursorRequest = index.openCursor(IDBKeyRange.only(incidentNo));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete photos."));
      tx.onabort = () => reject(tx.error ?? new Error("Photo delete transaction aborted."));
    });
  } finally {
    db.close();
  }
}
