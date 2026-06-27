import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Reorder, useDragControls } from "motion/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import {
  Copy,
  GripVertical,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildPhotoAnalysisContext,
  mapPhotoAnalysisToEntry,
  type PhotoAnalysisPartialEntry,
  type PhotoAnalysisReportContext,
} from "../lib/buildPhotoAnalysisContext";
import { usePhotoAnalysis } from "../hooks/usePhotoAnalysis";
import { AiProcessingDialog } from "./AiProcessingDialog";
import { isCoordinatorConfigured } from "../types/inference";
import {
  SECTION_LINK_BUTTON_LABELS,
  SUGGESTED_PHOTO_SECTIONS,
  type SuggestedPhotoSection,
} from "../types/photoAnalysis";
import {
  getPhotoLogDisplayInfo,
  type PhotoLogDisplayInfo,
  type PhotoLogEntry,
} from "../types/photoLog";

interface PhotoLogEditorProps {
  enabled: boolean;
  persistenceKey?: string | null;
  photos: PhotoLogEntry[];
  previewUrls: Record<string, string>;
  photoAnalysisContext: PhotoAnalysisReportContext;
  onAddPhotos: (files: FileList | File[]) => void;
  onRemovePhoto: (id: string) => void;
  onReorderPhotos: (orderedIds: string[]) => void;
  onCopyPhoto: (id: string) => void;
  onUpdatePhotoCaption: (id: string, caption: string) => void;
  onPhotosAnalyzed: (updates: Record<string, PhotoAnalysisPartialEntry>) => void;
  onApplyPhotoSection: (photoId: string, section: SuggestedPhotoSection) => void;
}

interface PhotoLogEditorSnapshot {
  selectedPhotoIds: string[];
}

const PHOTO_LOG_EDITOR_STORAGE_KEY = "firesight-photo-log-editor-state";

function formatEditorLabel(boxLabel: string): string {
  return boxLabel
    .replace(/^PHOTO /, "Photo ")
    .replace(/^COPY OF PHOTO /, "Copy of ");
}

export function PhotoLogEditor({
  enabled,
  persistenceKey = null,
  photos,
  previewUrls,
  photoAnalysisContext,
  onAddPhotos,
  onRemovePhoto,
  onReorderPhotos,
  onCopyPhoto,
  onUpdatePhotoCaption,
  onPhotosAnalyzed,
  onApplyPhotoSection,
}: PhotoLogEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const photoLogEditorStorageKey = persistenceKey
    ? `${PHOTO_LOG_EDITOR_STORAGE_KEY}:${persistenceKey}`
    : null;
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || !photoLogEditorStorageKey) return new Set();
    try {
      const raw = window.localStorage.getItem(photoLogEditorStorageKey);
      if (!raw) return new Set();
      const snapshot = JSON.parse(raw) as Partial<PhotoLogEditorSnapshot>;
      return new Set(
        Array.isArray(snapshot.selectedPhotoIds)
          ? snapshot.selectedPhotoIds.filter((id): id is string => typeof id === "string")
          : [],
      );
    } catch {
      window.localStorage.removeItem(photoLogEditorStorageKey);
      return new Set();
    }
  });
  const { isAnalyzing, progress, runBatchAnalysis } = usePhotoAnalysis();

  const displayInfo = useMemo(() => getPhotoLogDisplayInfo(photos), [photos]);
  const originalPhotos = useMemo(
    () => displayInfo.filter((info) => !info.isCopy),
    [displayInfo],
  );
  const coordinatorReady = isCoordinatorConfigured();

  useEffect(() => {
    if (!photoLogEditorStorageKey) {
      setSelectedPhotoIds(new Set());
      return;
    }

    try {
      const raw = window.localStorage.getItem(photoLogEditorStorageKey);
      if (!raw) {
        setSelectedPhotoIds(new Set());
        return;
      }

      const snapshot = JSON.parse(raw) as Partial<PhotoLogEditorSnapshot>;
      setSelectedPhotoIds(
        new Set(
          Array.isArray(snapshot.selectedPhotoIds)
            ? snapshot.selectedPhotoIds.filter((id): id is string => typeof id === "string")
            : [],
        ),
      );
    } catch {
      window.localStorage.removeItem(photoLogEditorStorageKey);
      setSelectedPhotoIds(new Set());
    }
  }, [photoLogEditorStorageKey]);

  useEffect(() => {
    setSelectedPhotoIds((current) => {
      const validIds = new Set(photos.map((photo) => photo.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [photos]);

  useEffect(() => {
    if (!photoLogEditorStorageKey) return;
    window.localStorage.setItem(
      photoLogEditorStorageKey,
      JSON.stringify({
        selectedPhotoIds: Array.from(selectedPhotoIds),
      } satisfies PhotoLogEditorSnapshot),
    );
  }, [photoLogEditorStorageKey, selectedPhotoIds]);

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

  const togglePhotoSelection = (photoId: string, checked: boolean) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
  };

  const selectAllOriginals = () => {
    setSelectedPhotoIds(new Set(originalPhotos.map((info) => info.entry.id)));
  };

  const clearSelection = () => {
    setSelectedPhotoIds(new Set());
  };

  const getSelectedItemsInOrder = (ids: Set<string>) =>
    originalPhotos
      .filter((info) => ids.has(info.entry.id))
      .map((info) => ({
        id: info.entry.id,
        blob: info.entry.blob,
        fileName: info.entry.fileName,
      }));

  const runAnalysisForSelection = async (ids: Set<string>) => {
    if (!coordinatorReady) {
      toast.error("Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)");
      return;
    }

    const items = getSelectedItemsInOrder(ids);
    if (items.length === 0) {
      toast.error("Select at least one original photo to analyze");
      return;
    }

    try {
      const results = await runBatchAnalysis(
        items,
        buildPhotoAnalysisContext(photoAnalysisContext),
      );

      const updates: Record<string, PhotoAnalysisPartialEntry> = {};
      for (const [id, result] of Object.entries(results)) {
        updates[id] = mapPhotoAnalysisToEntry(result);
      }
      onPhotosAnalyzed(updates);
      toast.success(
        items.length === 1
          ? "Photo analysis complete"
          : `${items.length} photos analyzed`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo analysis failed");
    }
  };

  const handleAnalyzeSelected = () => {
    void runAnalysisForSelection(selectedPhotoIds);
  };

  const handleReorder = (ordered: PhotoLogDisplayInfo[]) => {
    onReorderPhotos(ordered.map((info) => info.entry.id));
  };

  const selectedCount = selectedPhotoIds.size;

  return (
    <div
      className="space-y-3 mt-4 border-t pt-4"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <AiProcessingDialog
        open={isAnalyzing}
        kind="photo-analysis"
        progress={progress ?? undefined}
      />
      <div>
        <p className="text-sm font-medium">Photo log (Annex D &amp; F)</p>
        <p className="text-xs text-gray-500 mt-1">
          Upload fire-scene photos. Each photo is numbered in order; the UID is taken from the
          file name (without extension). Add a caption to fill Annex D and show below each photo
          in Annex F. Use Copy to add a &quot;Copy of photo&quot; entry in both annexes.
          Removing a photo renumbers the rest.
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

      {photos.length > 0 && (
        <div className="rounded-md border bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">AI photo analysis</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={selectedCount === 0 || isAnalyzing || !coordinatorReady}
              onClick={handleAnalyzeSelected}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Analyze selected ({selectedCount})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAnalyzing || originalPhotos.length === 0}
              onClick={selectAllOriginals}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAnalyzing || selectedCount === 0}
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
          {progress && (
            <p className="text-xs text-gray-600">
              Analyzing photo {progress.done + (isAnalyzing ? 1 : 0)} of {progress.total}…
            </p>
          )}
          {!coordinatorReady && (
            <p className="text-xs text-amber-700">
              Set VITE_COORDINATOR_URL and VITE_WEB_API_KEY to enable photo analysis.
            </p>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No photos added yet.</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={displayInfo}
          onReorder={handleReorder}
          className="space-y-3"
        >
          {displayInfo.map((info) => (
            <PhotoLogRow
              key={info.entry.id}
              info={info}
              previewUrl={previewUrls[info.entry.id]}
              isSelected={selectedPhotoIds.has(info.entry.id)}
              isAnalyzing={isAnalyzing}
              onToggleSelect={togglePhotoSelection}
              onCopyPhoto={onCopyPhoto}
              onRemovePhoto={onRemovePhoto}
              onUpdatePhotoCaption={onUpdatePhotoCaption}
              onApplyPhotoSection={onApplyPhotoSection}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

interface PhotoLogRowProps {
  info: PhotoLogDisplayInfo;
  previewUrl?: string;
  isSelected: boolean;
  isAnalyzing: boolean;
  onToggleSelect: (photoId: string, checked: boolean) => void;
  onCopyPhoto: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onUpdatePhotoCaption: (id: string, caption: string) => void;
  onApplyPhotoSection: (photoId: string, section: SuggestedPhotoSection) => void;
}

function PhotoLogRow({
  info,
  previewUrl,
  isSelected,
  isAnalyzing,
  onToggleSelect,
  onCopyPhoto,
  onRemovePhoto,
  onUpdatePhotoCaption,
  onApplyPhotoSection,
}: PhotoLogRowProps) {
  const photo = info.entry;
  const dragControls = useDragControls();
  const [dragging, setDragging] = useState(false);

  const editorLabel = formatEditorLabel(info.boxLabel);
  const rowLabel = `${editorLabel}: ${photo.uid}`;
  const hasAnalysis = photo.captionSource === "ai";

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    setDragging(true);
    dragControls.start(event);
    const stop = () => {
      setDragging(false);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <Reorder.Item
      value={info}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)" }}
      className={`rounded-md border p-3 ${
        info.isCopy ? "bg-slate-100 border-slate-200" : "bg-gray-50"
      } ${dragging ? "relative z-10 border-sky-400 ring-2 ring-sky-300" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Drag to reorder ${rowLabel}`}
          title="Drag to reorder"
          onPointerDown={startDrag}
          onContextMenu={(e) => e.preventDefault()}
          className={`mt-0.5 flex h-14 w-6 shrink-0 touch-none select-none items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 ${
            dragging ? "cursor-grabbing bg-sky-100 text-sky-600" : "cursor-grab"
          }`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {!info.isCopy && (
          <Checkbox
            className="mt-1"
            checked={isSelected}
            disabled={isAnalyzing}
            onCheckedChange={(checked) => onToggleSelect(photo.id, checked === true)}
            aria-label={`Select ${rowLabel} for analysis`}
          />
        )}
        <div className="w-14 h-14 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={rowLabel}
              draggable={false}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImagePlus className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold break-all">{rowLabel}</p>
            {info.isCopy && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Copy
              </Badge>
            )}
          </div>
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
      </div>
      <div className="mt-2">
        <Textarea
          id={`caption-${photo.id}`}
          value={photo.caption ?? ""}
          onChange={(e) => onUpdatePhotoCaption(photo.id, e.target.value)}
          rows={2}
          placeholder="Description for Annex D & F"
          className="text-sm"
        />
      </div>
      {!info.isCopy && hasAnalysis && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-gray-700">Link to:</span>
          {SUGGESTED_PHOTO_SECTIONS.map((section) => (
            <Button
              key={section}
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onApplyPhotoSection(photo.id, section)}
            >
              {SECTION_LINK_BUTTON_LABELS[section]}
            </Button>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}
