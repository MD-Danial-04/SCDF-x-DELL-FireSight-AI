import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  ANNEX_DEFINITIONS,
  ANNEX_REFERENCE_SOURCE,
  buildAnnexAttachmentList,
  getAnnexById,
  sortAnnexIds,
} from "../constants/annexDefinitions";
import { AnnexPageEditor } from "./AnnexPageEditor";
import { FloorplanAnnexEditor } from "./FloorplanAnnexEditor";
import { AnnexEEditor } from "./AnnexEEditor";
import { AnnexGBurnChartEditor } from "./AnnexGBurnChartEditor";
import { PhotoLogEditor } from "./PhotoLogEditor";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type { PhotoAnalysisPartialEntry, PhotoAnalysisReportContext } from "../lib/buildPhotoAnalysisContext";
import type { SuggestedPhotoSection } from "../types/photoAnalysis";

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
  onApplyPhotoSection?: (photoId: string, section: SuggestedPhotoSection) => void;
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
  floorplanSvg?: string | null;
  onFloorplanSvgChange?: (svg: string | null) => void;
}

interface EditorCardDefinition {
  id: string;
  title: string;
  description: string;
  annexes: string[];
  status: string;
  body: ReactNode;
}

function formatAnnexTitle(title: string) {
  return title.replace(/^Annex [A-G] â€“ ?/, "");
}

function buildStatusTone(status: string) {
  switch (status) {
    case "Edited":
    case "Ready":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "In progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
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
  const [openEditorId, setOpenEditorId] = useState<string>("");
  const [previewsOpen, setPreviewsOpen] = useState("generated-previews");

  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? sortAnnexIds([...selectedIds, id])
      : selectedIds.filter((x) => x !== id);
    onChange(next, buildAnnexAttachmentList(next));
  };

  const floorplanSelected = selectedIds.includes("A") || selectedIds.includes("E");
  const photoLogSelected = selectedIds.includes("D") || selectedIds.includes("F");
  const annexESelected = selectedIds.includes("E");
  const annexGSelected = selectedIds.includes("G");

  const editorCards = useMemo<EditorCardDefinition[]>(() => {
    const cards: EditorCardDefinition[] = [];

    if (onOverrideChange && floorplanSelected) {
      cards.push({
        id: "floorplan",
        title: "Floorplan editor",
        description: "Use the shared layout canvas for Annex A and Annex E.",
        annexes: ["A", "E"].filter((id) => selectedIds.includes(id)),
        status: floorplanSvg ? "Edited" : "Not started",
        body: (
          <FloorplanAnnexEditor
            enabled={selectedIds.includes("A")}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            onOverrideChange={onOverrideChange}
            onFloorplanSvgChange={onFloorplanSvgChange}
          />
        ),
      });
    }

    if (
      onAddPhotos &&
      onRemovePhoto &&
      onReorderPhoto &&
      onCopyPhoto &&
      onUpdatePhotoCaption &&
      onPhotosAnalyzed &&
      onApplyPhotoSection &&
      photoLogSelected
    ) {
      cards.push({
        id: "photo-log",
        title: "Photo log",
        description: "Manage the photo sequence used by Annex D and Annex F.",
        annexes: ["D", "F"].filter((id) => selectedIds.includes(id)),
        status: photos.length > 0 ? "In progress" : "Not started",
        body: (
          <PhotoLogEditor
            enabled
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
        ),
      });
    }

    if (onOverrideChange && annexESelected) {
      cards.push({
        id: "annex-e",
        title: "Annex E photo-direction editor",
        description: "Place directional markers on the floorplan for Annex E.",
        annexes: ["E"],
        status: overrides[4] ? "Edited" : "Not started",
        body: (
          <AnnexEEditor
            enabled
            floorplanSvg={floorplanSvg}
            photos={photos}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            onOverrideChange={onOverrideChange}
          />
        ),
      });
    }

    if (onOverrideChange && annexGSelected) {
      cards.push({
        id: "annex-g",
        title: "Annex G burn-chart editor",
        description: "Fill the burn sketch details and paint the affected area.",
        annexes: ["G"],
        status: overrides[8] ? "Edited" : "Not started",
        body: (
          <AnnexGBurnChartEditor
            enabled
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            nameOfVictim={nameOfVictim}
            nricFinNumber={nricFinNumber}
            onOverrideChange={onOverrideChange}
          />
        ),
      });
    }

    return cards;
  }, [
    annexESelected,
    annexGSelected,
    floorplanSelected,
    floorplanSvg,
    incidentNo,
    locationOfFire,
    nameOfVictim,
    nricFinNumber,
    onAddPhotos,
    onCopyPhoto,
    onApplyPhotoSection,
    onPhotosAnalyzed,
    onUpdatePhotoCaption,
    onOverrideChange,
    onRemovePhoto,
    onReorderPhoto,
    onFloorplanSvgChange,
    overrides,
    photoAnalysisContext,
    photoLogSelected,
    photoPreviewUrls,
    photos,
    selectedIds,
  ]);

  useEffect(() => {
    if (!editorCards.some((card) => card.id === openEditorId)) {
      setOpenEditorId("");
    }
  }, [editorCards, openEditorId]);

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="rounded-xl border border-border bg-white p-4">
        <Label className="text-sm font-medium">Annex reference source</Label>
        <p className="mt-1 font-mono text-sm text-gray-600">{ANNEX_REFERENCE_SOURCE}</p>
        <p className="mt-1 text-xs text-gray-500">
          Selected annex slides are appended as images at the end of the generated Word report.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <Label className="mb-3 block text-sm font-medium">Include annexes (A-G)</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ANNEX_DEFINITIONS.map((annex) => (
            <label
              key={annex.id}
              className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
            >
              <Checkbox
                checked={selectedIds.includes(annex.id)}
                onCheckedChange={(checked) => toggle(annex.id, checked === true)}
              />
              <span className="text-sm leading-snug">
                <span className="font-semibold">Annex {annex.id}</span>
                <span className="block text-gray-600">{formatAnnexTitle(annex.title)}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {editorCards.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-foreground">Selected annex editors</p>
            <p className="mt-1 text-xs text-gray-500">
              Only one editor stays open at a time to keep the page manageable.
            </p>
          </div>

          <Accordion
            type="single"
            collapsible
            value={openEditorId}
            onValueChange={setOpenEditorId}
            className="w-full"
          >
            {editorCards.map((card) => (
              <AccordionItem
                key={card.id}
                value={card.id}
                className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 last:mb-0"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{card.title}</span>
                        <Badge className={buildStatusTone(card.status)}>{card.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{card.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {card.annexes.map((annexId) => (
                        <Badge
                          key={`${card.id}-${annexId}`}
                          variant="outline"
                          className="border-slate-200 bg-white text-slate-700"
                        >
                          Annex {annexId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2">{card.body}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
      {onOverrideChange && selectedIds.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <Accordion
            type="single"
            collapsible
            value={previewsOpen}
            onValueChange={setPreviewsOpen}
            className="w-full"
          >
            <AccordionItem value="generated-previews" className="border-b-0">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Generated annex previews</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Review the final page images that will be appended to the report.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-0">
                <AnnexPageEditor
                  selectedIds={selectedIds}
                  overrides={overrides}
                  onOverrideChange={onOverrideChange}
                  headerPreviewUrls={headerPreviewUrls}
                  photoLogAnnexPreviewUrls={photoLogAnnexPreviewUrls}
                  photoLogPreviewLoading={photoLogPreviewLoading}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
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
      .filter(Boolean),
  );
}
