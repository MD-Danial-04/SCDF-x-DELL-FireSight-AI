export interface PhotoLogEntry {
  id: string;
  blob: Blob;
  fileName: string;
  uid: string;
  isCopy?: boolean;
  copyOfId?: string;
}

export interface PhotoLogHeaderInfo {
  incidentNo?: string;
  locationOfFire?: string;
}

export interface PhotoLogAnnexPreviewUrls {
  D: string[];
  F: string[];
}

export interface PhotoLogDisplayInfo {
  entry: PhotoLogEntry;
  isCopy: boolean;
  number: number | null;
  boxLabel: string;
  tableLabel: string;
}

/** UID = file name without extension, verbatim. */
export function parsePhotoUid(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

export function createPhotoLogEntry(file: File): PhotoLogEntry {
  return {
    id: crypto.randomUUID(),
    blob: file,
    fileName: file.name,
    uid: parsePhotoUid(file.name),
  };
}

export function createPhotoCopy(original: PhotoLogEntry): PhotoLogEntry {
  return {
    id: crypto.randomUUID(),
    blob: original.blob,
    fileName: original.fileName,
    uid: original.uid,
    isCopy: true,
    copyOfId: original.id,
  };
}

export function getPhotoLogDisplayInfo(photos: PhotoLogEntry[]): PhotoLogDisplayInfo[] {
  const numberById = new Map<string, number>();
  let nextNumber = 1;

  for (const entry of photos) {
    if (!entry.isCopy) {
      numberById.set(entry.id, nextNumber);
      nextNumber += 1;
    }
  }

  return photos.map((entry) => {
    const isCopy = Boolean(entry.isCopy);
    const number = isCopy ? null : (numberById.get(entry.id) ?? null);

    if (!isCopy && number !== null) {
      return {
        entry,
        isCopy: false,
        number,
        boxLabel: `PHOTO ${number}`,
        tableLabel: String(number),
      };
    }

    const originalNumber = entry.copyOfId ? numberById.get(entry.copyOfId) : undefined;
    if (originalNumber !== undefined) {
      return {
        entry,
        isCopy: true,
        number: null,
        boxLabel: `COPY OF PHOTO ${originalNumber}`,
        tableLabel: `Copy of ${originalNumber}`,
      };
    }

    return {
      entry,
      isCopy: true,
      number: null,
      boxLabel: "COPY OF PHOTO",
      tableLabel: "Copy",
    };
  });
}
