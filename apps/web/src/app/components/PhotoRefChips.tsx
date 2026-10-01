import { useMemo } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { type SuggestedPhotoSection } from "../types/photoAnalysis";
import { getPhotoLogDisplayInfo, type PhotoLogEntry } from "../types/photoLog";

interface PhotoRefChipsProps {
  section: SuggestedPhotoSection;
  label: string;
  photos: PhotoLogEntry[];
  photoPreviewUrls: Record<string, string>;
  linkedIds: string[];
  onLinksChange: (photoIds: string[]) => void;
}

export function PhotoRefChips({
  label,
  photos,
  photoPreviewUrls,
  linkedIds,
  onLinksChange,
}: PhotoRefChipsProps) {
  const displayById = useMemo(() => {
    const map = new Map<string, { boxLabel: string; sortKey: number }>();
    const info = getPhotoLogDisplayInfo(photos);
    const numberById = new Map<string, number>();
    for (const item of info) {
      if (item.number !== null) numberById.set(item.entry.id, item.number);
    }
    for (const item of info) {
      const original = item.entry.copyOfId
        ? numberById.get(item.entry.copyOfId)
        : undefined;
      const sortKey = item.number ?? original ?? Number.MAX_SAFE_INTEGER;
      map.set(item.entry.id, { boxLabel: item.boxLabel, sortKey });
    }
    return map;
  }, [photos]);

  const validLinkedIds = useMemo(
    () => linkedIds.filter((id) => displayById.has(id)),
    [linkedIds, displayById],
  );

  const availablePhotos = useMemo(
    () => photos.filter((p) => !linkedIds.includes(p.id)),
    [photos, linkedIds],
  );

  const moveLink = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= validLinkedIds.length) return;
    const next = [...validLinkedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onLinksChange(next);
  };

  const removeLink = (id: string) => {
    onLinksChange(validLinkedIds.filter((linkedId) => linkedId !== id));
  };

  const addLink = (id: string) => {
    onLinksChange([...validLinkedIds, id]);
  };

  return (
    <div>
      <Label className="flex items-center gap-2">{label}</Label>

      <div className="mt-1 rounded-md border border-slate-300 bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={availablePhotos.length === 0}
                className="h-8"
              >
                <ImagePlus className="mr-1 size-3.5" />
                Link photo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {availablePhotos.map((photo) => {
                const display = displayById.get(photo.id);
                const preview = photoPreviewUrls[photo.id];
                return (
                  <DropdownMenuItem
                    key={photo.id}
                    onSelect={() => addLink(photo.id)}
                    className="gap-2"
                  >
                    {preview && (
                      <img
                        src={preview}
                        alt=""
                        className="size-7 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="text-sm">
                      {display ? formatChip(display.boxLabel) : photo.uid}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {validLinkedIds.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            {photos.length === 0
              ? "Add photos to the photo log, then link them here."
              : "No photos linked yet. Use “Link photo” to reference photos."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {validLinkedIds.map((id, index) => {
              const display = displayById.get(id);
              return (
                <Badge
                  key={id}
                  variant="outline"
                  className="gap-1 border-slate-300 bg-slate-50 py-1 pl-1.5 pr-1 text-slate-700"
                >
                  <button
                    type="button"
                    aria-label="Move earlier"
                    onClick={() => moveLink(index, -1)}
                    disabled={index === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3" />
                  </button>
                  <span className="text-xs font-medium">
                    {display ? formatChip(display.boxLabel) : "Photo"}
                  </span>
                  <button
                    type="button"
                    aria-label="Move later"
                    onClick={() => moveLink(index, 1)}
                    disabled={index === validLinkedIds.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronRight className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove reference"
                    onClick={() => removeLink(id)}
                    className="ml-0.5 rounded text-slate-400 hover:bg-slate-200 hover:text-red-600"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatChip(boxLabel: string): string {
  return boxLabel
    .replace(/^PHOTO /, "Photo ")
    .replace(/^COPY OF PHOTO /, "Copy of ");
}
