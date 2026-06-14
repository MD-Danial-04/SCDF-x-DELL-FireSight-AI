import { useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronUp, Copy, ImagePlus, Trash2 } from "lucide-react";
import { getPhotoLogDisplayInfo, type PhotoLogEntry } from "../types/photoLog";

interface PhotoLogEditorProps {
  enabled: boolean;
  photos: PhotoLogEntry[];
  previewUrls: Record<string, string>;
  onAddPhotos: (files: FileList | File[]) => void;
  onRemovePhoto: (id: string) => void;
  onReorderPhoto: (id: string, direction: "up" | "down") => void;
  onCopyPhoto: (id: string) => void;
}

function formatEditorLabel(boxLabel: string): string {
  return boxLabel
    .replace(/^PHOTO /, "Photo ")
    .replace(/^COPY OF PHOTO /, "Copy of ");
}

export function PhotoLogEditor({
  enabled,
  photos,
  previewUrls,
  onAddPhotos,
  onRemovePhoto,
  onReorderPhoto,
  onCopyPhoto,
}: PhotoLogEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const displayInfo = useMemo(() => getPhotoLogDisplayInfo(photos), [photos]);

  if (!enabled) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) onAddPhotos(files);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === "image/png" || item.type === "image/jpeg") {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      onAddPhotos(imageFiles);
    }
  };

  return (
    <div
      className="space-y-3 mt-4 border-t pt-4"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div>
        <p className="text-sm font-medium">Photo log (Annex D &amp; F)</p>
        <p className="text-xs text-gray-500 mt-1">
          Upload fire-scene photos. Each photo is numbered in order; the UID is taken from the
          file name (without extension). Use Copy to add a &quot;Copy of photo&quot; entry in
          both annexes. Removing a photo renumbers the rest.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          Add photos
        </Button>
        <span className="text-xs text-gray-500 self-center">
          or paste images here (focus this section first)
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No photos added yet.</p>
      ) : (
        <ul className="space-y-2">
          {displayInfo.map((info, index) => {
            const photo = info.entry;
            const editorLabel = formatEditorLabel(info.boxLabel);

            return (
              <li
                key={photo.id}
                className={`flex items-center gap-3 rounded-md border p-2 ${
                  info.isCopy ? "bg-slate-100 border-slate-200" : "bg-gray-50"
                }`}
              >
                <div className="w-14 h-14 shrink-0 rounded border bg-white overflow-hidden">
                  {previewUrls[photo.id] ? (
                    <img
                      src={previewUrls[photo.id]}
                      alt={editorLabel}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{editorLabel}</p>
                    {info.isCopy && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Copy
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate" title={photo.fileName}>
                    {photo.fileName}
                  </p>
                  <p className="text-xs font-mono text-gray-800 mt-0.5">
                    UID: {photo.uid}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => onReorderPhoto(photo.id, "up")}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === photos.length - 1}
                    title="Move down"
                    onClick={() => onReorderPhoto(photo.id, "down")}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                {!info.isCopy && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Create copy of photo"
                    onClick={() => onCopyPhoto(photo.id)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Remove photo"
                  onClick={() => onRemovePhoto(photo.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
