import { useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import {
  ChevronDown,
  ChevronUp,
  Copy,
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
import { isCoordinatorConfigured } from "../types/inference";
import {
  PHOTO_REF_LABELS,
  SUGGESTED_SECTION_CONFIDENCE_THRESHOLD,
} from "../types/photoAnalysis";
import { getPhotoLogDisplayInfo, type PhotoLogEntry } from "../types/photoLog";

interface PhotoLogEditorProps {
  enabled: boolean;
  photos: PhotoLogEntry[];
  previewUrls: Record<string, string>;
  photoAnalysisContext: PhotoAnalysisReportContext;
  onAddPhotos: (files: FileList | File[]) => void;
  onRemovePhoto: (id: string) => void;
  onReorderPhoto: (id: string, direction: "up" | "down") => void;
  onCopyPhoto: (id: string) => void;
  onUpdatePhotoCaption: (id: string, caption: string) => void;
  onPhotosAnalyzed: (updates: Record<string, PhotoAnalysisPartialEntry>) => void;
  onApplyPhotoSection: (photoId: string) => void;
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
  photoAnalysisContext,
  onAddPhotos,
  onRemovePhoto,
  onReorderPhoto,
  onCopyPhoto,
  onUpdatePhotoCaption,
  onPhotosAnalyzed,
  onApplyPhotoSection,
}: PhotoLogEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const [selectNextCount, setSelectNextCount] = useState("3");
  const { isAnalyzing, analyzingPhotoIds, progress, runBatchAnalysis } = usePhotoAnalysis();

  const displayInfo = useMemo(() => getPhotoLogDisplayInfo(photos), [photos]);
  const originalPhotos = useMemo(
    () => displayInfo.filter((info) => !info.isCopy),
    [displayInfo],
  );
  const coordinatorReady = isCoordinatorConfigured();

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

  const selectNextUnanalyzed = () => {
    const count = Math.max(1, Number.parseInt(selectNextCount, 10) || 1);
    const unanalyzed = originalPhotos.filter(
      (info) => info.entry.captionSource !== "ai",
    );
    setSelectedPhotoIds(new Set(unanalyzed.slice(0, count).map((info) => info.entry.id)));
  };

  const getSelectedItemsInOrder = (ids: Set<string>) =>
    originalPhotos
      .filter((info) => ids.has(info.entry.id))
      .map((info) => ({
        id: info.entry.id,
        blob: info.entry.blob,
        fileName: info.entry.fileName,
        number: info.number,
        uid: info.entry.uid,
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
      const results = await runBatchAnalysis(items, (priorResults, currentItem) => {
        const priorCaptions = originalPhotos
          .filter((info) => {
            if (info.number === null) return false;
            const currentIndex = originalPhotos.findIndex(
              (item) => item.entry.id === currentItem.id,
            );
            const infoIndex = originalPhotos.findIndex(
              (item) => item.entry.id === info.entry.id,
            );
            return infoIndex >= 0 && infoIndex < currentIndex;
          })
          .map((info) => {
            const fromBatch = priorResults[info.entry.id];
            return {
              number: info.number as number,
              uid: info.entry.uid,
              suggestedSection:
                fromBatch?.suggested_section ?? info.entry.suggestedSection ?? null,
              detectedElements:
                fromBatch?.detected_elements ?? info.entry.detectedElements ?? [],
              caption: fromBatch?.caption ?? info.entry.caption,
            };
          })
          .filter(
            (item) =>
              (item.detectedElements?.length ?? 0) > 0 ||
              (item.caption?.trim().length ?? 0) > 0,
          );

        return buildPhotoAnalysisContext(photoAnalysisContext, priorCaptions);
      });

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

  const handleAnalyzeSingle = (photoId: string) => {
    void runAnalysisForSelection(new Set([photoId]));
  };

  const selectedCount = selectedPhotoIds.size;

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
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                className="h-8 w-14 text-xs"
                value={selectNextCount}
                disabled={isAnalyzing}
                onChange={(e) => setSelectNextCount(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isAnalyzing || originalPhotos.length === 0}
                onClick={selectNextUnanalyzed}
              >
                Select next N unanalyzed
              </Button>
            </div>
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
        <ul className="space-y-3">
          {displayInfo.map((info, index) => {
            const photo = info.entry;
            const editorLabel = formatEditorLabel(info.boxLabel);
            const isAnalyzingThis = analyzingPhotoIds.has(photo.id);
            const hasSectionSuggestion = Boolean(photo.suggestedSection);
            const lowConfidenceSection =
              !photo.suggestedSection &&
              photo.suggestedSectionConfidence != null &&
              photo.suggestedSectionConfidence < SUGGESTED_SECTION_CONFIDENCE_THRESHOLD;

            return (
              <li
                key={photo.id}
                className={`rounded-md border p-3 ${
                  info.isCopy ? "bg-slate-100 border-slate-200" : "bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!info.isCopy && (
                    <Checkbox
                      className="mt-1"
                      checked={selectedPhotoIds.has(photo.id)}
                      disabled={isAnalyzing}
                      onCheckedChange={(checked) =>
                        togglePhotoSelection(photo.id, checked === true)
                      }
                      aria-label={`Select ${editorLabel} for analysis`}
                    />
                  )}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{editorLabel}</p>
                      {info.isCopy && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Copy
                        </Badge>
                      )}
                      {photo.captionSource === "ai" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          AI caption
                        </Badge>
                      )}
                      {hasSectionSuggestion && photo.suggestedSection && (
                        <Badge className="text-[10px] px-1.5 py-0">
                          {PHOTO_REF_LABELS[photo.suggestedSection]}
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
                </div>
                <div className="mt-2">
                  <Label htmlFor={`caption-${photo.id}`} className="text-xs text-gray-600">
                    Caption
                  </Label>
                  <Textarea
                    id={`caption-${photo.id}`}
                    value={photo.caption ?? ""}
                    onChange={(e) => onUpdatePhotoCaption(photo.id, e.target.value)}
                    rows={2}
                    placeholder="Description for Annex D & F"
                    className="mt-1 text-sm"
                  />
                </div>
                {!info.isCopy && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isAnalyzing || !coordinatorReady}
                      onClick={() => handleAnalyzeSingle(photo.id)}
                    >
                      {isAnalyzingThis ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Analyze
                    </Button>
                    {hasSectionSuggestion && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onApplyPhotoSection(photo.id)}
                      >
                        Apply to report
                      </Button>
                    )}
                  </div>
                )}
                {photo.detectedElements && photo.detectedElements.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {photo.detectedElements.map((element) => (
                      <Badge key={element} variant="secondary" className="text-[10px]">
                        {element}
                      </Badge>
                    ))}
                  </div>
                )}
                {lowConfidenceSection && (
                  <p className="mt-1 text-xs text-gray-500">
                    Section suggestion below confidence threshold (
                    {Math.round(photo.suggestedSectionConfidence! * 100)}%).
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
