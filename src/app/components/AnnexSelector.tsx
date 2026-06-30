import { useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { cn } from "./ui/utils";
import {
  ANNEX_DEFINITIONS,
  buildAnnexAttachmentList,
  getAnnexById,
  sortAnnexIds,
} from "../constants/annexDefinitions";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";
import { FloorplanAnnexEditor } from "./FloorplanAnnexEditor";
import { AnnexImageUploadEditor } from "./AnnexImageUploadEditor";
import { AnnexEEditor } from "./AnnexEEditor";
import { AnnexGBurnChartEditor, type AnnexGEditorState } from "./AnnexGBurnChartEditor";
import { PhotoLogEditor } from "./PhotoLogEditor";
import type { PhotoLogAnnexPreviewUrls, PhotoLogEntry } from "../types/photoLog";
import type { FloorplanDraftPayload } from "../lib/floorplanDrafts";
import type { AnnexEMarker } from "../lib/annexEMarkers";
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
  onReorderPhotos?: (orderedIds: string[]) => void;
  onCopyPhoto?: (id: string) => void;
  onUpdatePhotoCaption?: (id: string, caption: string) => void;
  photoAnalysisContext?: PhotoAnalysisReportContext;
  onPhotosAnalyzed?: (updates: Record<string, PhotoAnalysisPartialEntry>) => void;
  onApplyPhotoSection?: (photoId: string, section: SuggestedPhotoSection) => void;
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
  floorplanSvg?: string | null;
  floorplanPersistenceKey?: string | null;
  onFloorplanSvgChange?: (svg: string | null) => void;
  floorplanDraftState?: FloorplanDraftPayload | null;
  onFloorplanDraftStateChange?: (payload: FloorplanDraftPayload) => void;
  annexEMarkers?: AnnexEMarker[] | null;
  onAnnexEMarkersChange?: (markers: AnnexEMarker[]) => void;
  annexGState?: AnnexGEditorState | null;
  onAnnexGStateChange?: (state: AnnexGEditorState) => void;
}

interface EditorCardDefinition {
  id: string;
  title: string;
  description: string;
  annexes: string[];
  status: string;
  body: ReactNode;
}

const PHOTO_LOG_IDS = ["D", "E", "F"] as const;

/** Selector row id -> editor card ids hosted inline under that row. */
const ROW_CARD_IDS: Record<string, string[]> = {
  A: ["annex-a-image"],
  B: ["annex-b-image"],
  C: ["floorplan"],
  photoLog: ["photo-log", "annex-e"],
  G: ["annex-g"],
};

/** Editor cards whose internal state must survive collapse (canvas/painting). */
const PERSISTENT_CARD_IDS = ["photo-log", "annex-g"];

type SelectorRow =
  | { kind: "single"; annex: (typeof ANNEX_DEFINITIONS)[number] }
  | { kind: "photoLog" };

function summarizeRowStatus(cards: EditorCardDefinition[]): string {
  if (cards.some((c) => c.status === "In progress")) return "In progress";
  if (cards.some((c) => c.status === "Edited" || c.status === "Ready")) return "Edited";
  return "Not started";
}

function formatAnnexTitle(title: string) {
  return title.replace(/^Annex [A-G]\s*[–-]\s*/, "");
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
  onReorderPhotos,
  onCopyPhoto,
  onUpdatePhotoCaption,
  photoAnalysisContext = {},
  onPhotosAnalyzed,
  onApplyPhotoSection,
  photoLogAnnexPreviewUrls = { D: [], F: [] },
  photoLogPreviewLoading = false,
  floorplanDraftState = null,
  onFloorplanDraftStateChange,
  annexEMarkers = null,
  onAnnexEMarkersChange,
  annexGState = null,
  onAnnexGStateChange,
  floorplanSvg = null,
  floorplanPersistenceKey = null,
  onFloorplanSvgChange,
}: AnnexSelectorProps) {
  const [openEditorId, setOpenEditorId] = useState<string>("");
  const [mobileEditorRowId, setMobileEditorRowId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? sortAnnexIds([...selectedIds, id])
      : selectedIds.filter((x) => x !== id);
    onChange(next, buildAnnexAttachmentList(next));
  };

  const photoLogChecked = PHOTO_LOG_IDS.every((id) => selectedIds.includes(id));

  const togglePhotoLog = (checked: boolean) => {
    const set = new Set(selectedIds);
    PHOTO_LOG_IDS.forEach((id) => (checked ? set.add(id) : set.delete(id)));
    const next = sortAnnexIds([...set]);
    onChange(next, buildAnnexAttachmentList(next));
  };

  const selectorRows = useMemo<SelectorRow[]>(() => {
    const rows: SelectorRow[] = [];
    let photoLogInserted = false;
    for (const annex of ANNEX_DEFINITIONS) {
      if (PHOTO_LOG_IDS.includes(annex.id as (typeof PHOTO_LOG_IDS)[number])) {
        if (!photoLogInserted) {
          rows.push({ kind: "photoLog" });
          photoLogInserted = true;
        }
        continue;
      }
      rows.push({ kind: "single", annex });
    }
    return rows;
  }, []);

  const allAnnexesSelected = selectedIds.length === ANNEX_DEFINITIONS.length;

  const toggleAllAnnexes = (checked: boolean) => {
    const next = checked ? sortAnnexIds(ANNEX_DEFINITIONS.map((annex) => annex.id)) : [];
    onChange(next, buildAnnexAttachmentList(next));
  };

  const floorplanSelected = selectedIds.includes("C") || selectedIds.includes("E");
  const photoLogSelected = selectedIds.includes("D") || selectedIds.includes("F");
  const annexASelected = selectedIds.includes("A");
  const annexBSelected = selectedIds.includes("B");
  const annexESelected = selectedIds.includes("E");
  const annexGSelected = selectedIds.includes("G");

  const editorCards = useMemo<EditorCardDefinition[]>(() => {
    const cards: EditorCardDefinition[] = [];

    if (onOverrideChange && annexASelected) {
      cards.push({
        id: "annex-a-image",
        title: "Annex A location plan",
        description: "Upload an image to place in the centre of the Annex A template.",
        annexes: ["A"],
        status: overrides[0] ? "Edited" : "Not started",
        body: (
          <AnnexImageUploadEditor
            annexId="A"
            pageIndex={0}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            previewUrl={overrides[0]}
            onOverrideChange={onOverrideChange}
          />
        ),
      });
    }

    if (onOverrideChange && annexBSelected) {
      cards.push({
        id: "annex-b-image",
        title: "Annex B site plan",
        description: "Upload an image to place in the centre of the Annex B template.",
        annexes: ["B"],
        status: overrides[1] ? "Edited" : "Not started",
        body: (
          <AnnexImageUploadEditor
            annexId="B"
            pageIndex={1}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            previewUrl={overrides[1]}
            onOverrideChange={onOverrideChange}
          />
        ),
      });
    }

    if (onOverrideChange && floorplanSelected) {
      cards.push({
        id: "floorplan",
        title: "Floorplan editor",
        description: "Use the shared layout canvas for Annex C and Annex E.",
        annexes: ["C", "E"].filter((id) => selectedIds.includes(id)),
        status: floorplanSvg ? "Edited" : "Not started",
        body: (
          <FloorplanAnnexEditor
            enabled={selectedIds.includes("C")}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            floorplanSvg={floorplanSvg}
            persistenceKey={floorplanPersistenceKey}
            onOverrideChange={onOverrideChange}
            onFloorplanSvgChange={onFloorplanSvgChange}
            initialDraftState={floorplanDraftState}
            onDraftStateChange={onFloorplanDraftStateChange}
          />
        ),
      });
    }

    if (
      onAddPhotos &&
      onRemovePhoto &&
      onReorderPhotos &&
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
            persistenceKey={floorplanPersistenceKey}
            photos={photos}
            previewUrls={photoPreviewUrls}
            photoAnalysisContext={photoAnalysisContext}
            onAddPhotos={onAddPhotos}
            onRemovePhoto={onRemovePhoto}
            onReorderPhotos={onReorderPhotos}
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
            photoPreviewUrls={photoPreviewUrls}
            incidentNo={incidentNo}
            locationOfFire={locationOfFire}
            onOverrideChange={onOverrideChange}
            initialMarkers={annexEMarkers}
            onMarkersChange={onAnnexEMarkersChange}
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
            persistenceKey={floorplanPersistenceKey}
            onOverrideChange={onOverrideChange}
            initialState={annexGState}
            onStateChange={onAnnexGStateChange}
          />
        ),
      });
    }

    return cards;
  }, [
    annexASelected,
    annexBSelected,
    annexESelected,
    annexGSelected,
    floorplanSelected,
    floorplanPersistenceKey,
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
    onReorderPhotos,
    onFloorplanSvgChange,
    floorplanDraftState,
    onFloorplanDraftStateChange,
    annexEMarkers,
    onAnnexEMarkersChange,
    annexGState,
    onAnnexGStateChange,
    overrides,
    photoAnalysisContext,
    photoLogSelected,
    photoPreviewUrls,
    photos,
    selectedIds,
  ]);

  const annexPreviews = useMemo(() => {
    const resolvePageImage = (pageIndex: number): string | null =>
      overrides[pageIndex] ??
      headerPreviewUrls[pageIndex] ??
      getDefaultPagePreviewUrl(pageIndex);

    return sortAnnexIds(selectedIds)
      .map((id) => getAnnexById(id))
      .filter((annex): annex is (typeof ANNEX_DEFINITIONS)[number] => Boolean(annex))
      .map((annex) => {
        const photoLogImages =
          annex.id === "D"
            ? photoLogAnnexPreviewUrls.D ?? []
            : annex.id === "F"
              ? photoLogAnnexPreviewUrls.F ?? []
              : [];

        const images =
          photoLogImages.length > 0
            ? photoLogImages
            : annex.pageIndices
                .map(resolvePageImage)
                .filter((url): url is string => Boolean(url));

        return { annex, images };
      });
  }, [selectedIds, overrides, headerPreviewUrls, photoLogAnnexPreviewUrls]);

  const cardsByRow = useMemo(() => {
    const map: Record<string, EditorCardDefinition[]> = {};
    for (const [rowId, cardIds] of Object.entries(ROW_CARD_IDS)) {
      const owned = editorCards.filter((card) => cardIds.includes(card.id));
      if (owned.length > 0) map[rowId] = owned;
    }
    return map;
  }, [editorCards]);

  useEffect(() => {
    if (openEditorId && !cardsByRow[openEditorId]) {
      setOpenEditorId("");
    }
  }, [cardsByRow, openEditorId]);

  useEffect(() => {
    if (mobileEditorRowId && !cardsByRow[mobileEditorRowId]) {
      setMobileEditorRowId(null);
    }
  }, [cardsByRow, mobileEditorRowId]);

  const mobileRow = mobileEditorRowId
    ? selectorRows.find(
        (row) => (row.kind === "single" ? row.annex.id : "photoLog") === mobileEditorRowId,
      )
    : null;
  const mobileTitle = mobileRow
    ? mobileRow.kind === "single"
      ? `Annex ${mobileRow.annex.id} – ${formatAnnexTitle(mobileRow.annex.title)}`
      : "Photo Log"
    : "";

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="mb-3 text-xs text-gray-500">
          Tick an annex to include it. Selected annexes with an editor can be expanded to edit the
          page inline; only one editor stays open at a time.
        </p>

        <Accordion
          type="single"
          collapsible
          value={openEditorId}
          onValueChange={(value) => {
            if (isMobile) {
              if (value) setMobileEditorRowId(value);
              setOpenEditorId("");
              return;
            }
            setOpenEditorId(value);
          }}
          className="grid grid-cols-1 gap-2"
        >
          {selectorRows.map((row) => {
            const isSingle = row.kind === "single";
            const rowId = isSingle ? row.annex.id : "photoLog";
            const checked = isSingle ? selectedIds.includes(row.annex.id) : photoLogChecked;
            const onToggle = (next: boolean) =>
              isSingle ? toggle(row.annex.id, next) : togglePhotoLog(next);
            const label = isSingle ? `Annex ${row.annex.id}` : "Photo Log";
            const description = isSingle
              ? formatAnnexTitle(row.annex.title)
              : "Annexes D–F (table, plan, photographs)";

            const ownedCards = cardsByRow[rowId] ?? [];
            const hasEditor = ownedCards.length > 0;
            const persistent = ownedCards.some((card) => PERSISTENT_CARD_IDS.includes(card.id));

            const checkbox = (
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => onToggle(value === true)}
                aria-label={`Include ${label}`}
              />
            );
            const labelText = (
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-sm leading-snug">
                <span className="font-semibold whitespace-nowrap">{label}</span>
                <span className="text-gray-600">{description}</span>
              </span>
            );

            if (!hasEditor) {
              return (
                <label
                  key={rowId}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
                >
                  {checkbox}
                  {labelText}
                </label>
              );
            }

            return (
              <AccordionItem
                key={rowId}
                value={rowId}
                className="overflow-hidden rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-2 px-3 transition hover:bg-slate-50">
                  {checkbox}
                  <AccordionTrigger className="flex-1 items-center py-3 hover:no-underline">
                    <span className="flex flex-1 items-center gap-2">
                      {labelText}
                      <Badge
                        className={cn(
                          "self-start",
                          buildStatusTone(summarizeRowStatus(ownedCards)),
                        )}
                      >
                        {summarizeRowStatus(ownedCards)}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                </div>
                {!isMobile && (
                  <AccordionContent
                    forceMount={persistent ? true : undefined}
                    className="border-t border-slate-200 bg-slate-50/60 px-3 pt-3"
                  >
                    <div
                      className={cn(
                        "space-y-4",
                        persistent && openEditorId !== rowId && "hidden",
                      )}
                    >
                      {ownedCards.map((card) => (
                        <div key={card.id}>{card.body}</div>
                      ))}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Preview all annexes</h3>
          {photoLogPreviewLoading && (
            <span className="text-xs text-gray-500">Updating photo log previews…</span>
          )}
        </div>

        {annexPreviews.length === 0 ? (
          <p className="text-xs text-gray-500">
            Select one or more annexes above to preview them here.
          </p>
        ) : (
          <div className="space-y-5">
            {annexPreviews.map(({ annex, images }) => (
              <div key={annex.id} className="space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  Annex {annex.id} – {formatAnnexTitle(annex.title)}
                </p>
                {images.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    {(annex.id === "D" || annex.id === "F") && photoLogPreviewLoading
                      ? "Generating preview…"
                      : "No preview available yet."}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {images.map((src, index) => (
                      <div
                        key={`${annex.id}-${index}`}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                      >
                        <img
                          src={src}
                          alt={`Annex ${annex.id} preview ${index + 1}`}
                          loading="lazy"
                          className="block w-full"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isMobile && (
        <Dialog
          open={mobileEditorRowId !== null}
          onOpenChange={(open) => !open && setMobileEditorRowId(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="top-0 left-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
          >
            <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 border-b border-border bg-background px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-left">
              <DialogTitle className="truncate">{mobileTitle}</DialogTitle>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="-mr-2 shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            </DialogHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              {(mobileEditorRowId ? cardsByRow[mobileEditorRowId] ?? [] : []).map((card) => (
                <div key={card.id}>{card.body}</div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
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
