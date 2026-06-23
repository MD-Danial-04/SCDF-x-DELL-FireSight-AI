import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  ANNEX_DEFINITIONS,
  ANNEX_REFERENCE_SOURCE,
  buildAnnexAttachmentList,
  sortAnnexIds,
} from "../constants/annexDefinitions";
import { AnnexPageEditor } from "./AnnexPageEditor";
import { FloorplanAnnexEditor } from "./FloorplanAnnexEditor";
import { AnnexEEditor } from "./AnnexEEditor";
import { AnnexGBurnChartEditor } from "./AnnexGBurnChartEditor";
import { PhotoLogEditor } from "./PhotoLogEditor";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type { PhotoAnalysisPartialEntry, PhotoAnalysisReportContext } from "../lib/buildPhotoAnalysisContext";

interface AnnexSelectorProps {
  selectedIds: string[];
  onChange: (selectedIds: string[], attachmentList: string) => void;
  incidentNo?: string;
  locationOfFire?: string;
  nameOfVictim?: string;
  nricFinNumber?: string;
  overrides?: Record<number, string>;
  headerPreviewUrls?: Record<number, string>;
  onOverrideChange?: (pageIndex: number, blob: Blob | null) => void;
  photos?: PhotoLogEntry[];
  photoPreviewUrls?: Record<string, string>;
  onAddPhotos?: (files: FileList | File[]) => void;
  onRemovePhoto?: (id: string) => void;
  onReorderPhoto?: (id: string, direction: "up" | "down") => void;
  onCopyPhoto?: (id: string) => void;
  onUpdatePhotoCaption?: (id: string, caption: string) => void;
  photoAnalysisContext?: PhotoAnalysisReportContext;
  onPhotosAnalyzed?: (updates: Record<string, PhotoAnalysisPartialEntry>) => void;
  onApplyPhotoSection?: (photoId: string) => void;
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
  floorplanSvg?: string | null;
  onFloorplanSvgChange?: (svg: string | null) => void;
}

export function AnnexSelector({
  selectedIds,
  onChange,
  incidentNo,
  locationOfFire,
  nameOfVictim,
  nricFinNumber,
  overrides = {},
  headerPreviewUrls = {},
  onOverrideChange,
  photos = [],
  photoPreviewUrls = {},
  onAddPhotos,
  onRemovePhoto,
  onReorderPhoto,
  onCopyPhoto,
  onUpdatePhotoCaption,
  photoAnalysisContext = {},
  onPhotosAnalyzed,
  onApplyPhotoSection,
  photoLogAnnexPreviewUrls = { D: [], F: [] },
  photoLogPreviewLoading = false,
  floorplanSvg = null,
  onFloorplanSvgChange,
}: AnnexSelectorProps) {
  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? sortAnnexIds([...selectedIds, id])
      : selectedIds.filter((x) => x !== id);
    onChange(next, buildAnnexAttachmentList(next));
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <Label className="text-sm font-medium">Annex reference source</Label>
        <p className="text-sm text-gray-600 mt-1 font-mono">{ANNEX_REFERENCE_SOURCE}</p>
        <p className="text-xs text-gray-500 mt-1">
          Selected annex slides are appended as images at the end of the generated Word report.
        </p>
      </div>
      <div>
        <Label className="text-sm font-medium mb-2 block">Include annexes (A–G)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANNEX_DEFINITIONS.map((annex) => (
            <label
              key={annex.id}
              className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-gray-50"
            >
              <Checkbox
                checked={selectedIds.includes(annex.id)}
                onCheckedChange={(checked) => toggle(annex.id, checked === true)}
              />
              <span className="text-sm leading-snug">
                <span className="font-semibold">Annex {annex.id}</span>
                <span className="text-gray-600 block">
                  {annex.title.replace(/^Annex [A-G] – ?/, "")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {onOverrideChange && (
        <FloorplanAnnexEditor
          enabled={selectedIds.includes("A")}
          incidentNo={incidentNo}
          locationOfFire={locationOfFire}
          onOverrideChange={onOverrideChange}
          onFloorplanSvgChange={onFloorplanSvgChange}
        />
      )}
      {onAddPhotos &&
        onRemovePhoto &&
        onReorderPhoto &&
        onCopyPhoto &&
        onUpdatePhotoCaption &&
        onPhotosAnalyzed &&
        onApplyPhotoSection && (
        <PhotoLogEditor
          enabled={
            selectedIds.includes("D") ||
            selectedIds.includes("E") ||
            selectedIds.includes("F")
          }
          photos={photos}
          previewUrls={photoPreviewUrls}
          photoAnalysisContext={photoAnalysisContext}
          onAddPhotos={onAddPhotos}
          onRemovePhoto={onRemovePhoto}
          onReorderPhoto={onReorderPhoto}
          onCopyPhoto={onCopyPhoto}
          onUpdatePhotoCaption={onUpdatePhotoCaption}
          onPhotosAnalyzed={onPhotosAnalyzed}
          onApplyPhotoSection={onApplyPhotoSection}
        />
      )}
      {onOverrideChange && (
        <AnnexEEditor
          enabled={selectedIds.includes("E")}
          floorplanSvg={floorplanSvg}
          photos={photos}
          incidentNo={incidentNo}
          locationOfFire={locationOfFire}
          onOverrideChange={onOverrideChange}
        />
      )}
      {onOverrideChange && selectedIds.includes("G") && (
        <AnnexGBurnChartEditor
          enabled
          incidentNo={incidentNo}
          locationOfFire={locationOfFire}
          nameOfVictim={nameOfVictim}
          nricFinNumber={nricFinNumber}
          onOverrideChange={onOverrideChange}
        />
      )}
      {onOverrideChange && (
        <AnnexPageEditor
          selectedIds={selectedIds}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
          headerPreviewUrls={headerPreviewUrls}
          photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
          photoLogPreviewLoading={photoLogPreviewLoading}
        />
      )}
    </div>
  );
}

export function parseSelectedAnnexes(value: string): string[] {
  if (!value.trim()) return [];
  return sortAnnexIds(
    value
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}
