import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getAnnexById } from "../constants/annexDefinitions";
import { getPageLabel, hasDefaultPageAsset } from "../constants/annexPageDefaults";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";
import type { PhotoLogAnnexPreviewUrls } from "../types/photoLog";

interface AnnexPageEditorProps {
  selectedIds: string[];
  overrides: Record<number, string>;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
  headerPreviewUrls?: Record<number, string>;
  photoLogAnnexPreviewUrls?: PhotoLogAnnexPreviewUrls;
  photoLogPreviewLoading?: boolean;
}

interface PageEntry {
  key: string;
  annexId: string;
  pageIndex: number;
  subIndex?: number;
  generatedPreviewUrl?: string;
  readOnly?: boolean;
  readOnlyCaption?: string;
}

function PageCard({
  pageIndex,
  annexId,
  subIndex,
  previewUrl,
  generatedPreviewUrl,
  headerPreviewUrl,
  readOnly = false,
  readOnlyCaption,
  loading = false,
  onOverrideChange,
}: {
  pageIndex: number;
  annexId: string;
  subIndex?: number;
  previewUrl?: string;
  generatedPreviewUrl?: string;
  headerPreviewUrl?: string;
  readOnly?: boolean;
  readOnlyCaption?: string;
  loading?: boolean;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
}) {
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const defaultUrl = getDefaultPagePreviewUrl(pageIndex);
  const displayUrl = generatedPreviewUrl ?? previewUrl ?? headerPreviewUrl ?? defaultUrl;
  const hasOverride = Boolean(previewUrl || generatedPreviewUrl);
  const needsPaste = !readOnly && !hasDefaultPageAsset(pageIndex) && !hasOverride;

  const applyImageBlob = (blob: Blob | null) => {
    if (!blob) return;
    if (!blob.type.startsWith("image/")) return;
    onOverrideChange(pageIndex, blob);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === "image/png" || item.type === "image/jpeg") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          applyImageBlob(file);
          return;
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyImageBlob(file);
    e.target.value = "";
  };

  const label = getPageLabel(pageIndex, annexId, subIndex);
  const annexLabel =
    annexId === "F" && subIndex !== undefined
      ? ` · F-${subIndex + 1}`
      : annexId === "D" && subIndex !== undefined
        ? ` · D-${subIndex + 1}`
        : ` · Page ${pageIndex}`;

  return (
    <div className="flex flex-col w-full min-w-0">
      <p className="text-[10px] text-gray-600 mb-0.5 truncate" title={label}>
        Annex {annexId}
        {annexLabel}
      </p>
      <div
        tabIndex={readOnly ? undefined : 0}
        role={readOnly ? undefined : "button"}
        onFocus={readOnly ? undefined : () => setFocused(true)}
        onBlur={readOnly ? undefined : () => setFocused(false)}
        onPaste={handlePaste}
        onClick={readOnly ? undefined : () => fileRef.current?.click()}
        className={`relative rounded-md border-2 overflow-hidden aspect-[719/1058] bg-gray-100 transition-colors ${
          readOnly
            ? "border-gray-200"
            : `cursor-pointer ${focused ? "border-red-500 ring-2 ring-red-200" : "border-gray-200 hover:border-gray-300"}`
        }`}
      >
        {displayUrl ? (
          <img src={displayUrl} alt={label} className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-1 text-center text-[10px] text-amber-700 bg-amber-50">
            <ImagePlus className="w-4 h-4 mb-0.5 opacity-60" />
            Paste required
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        )}
        {!readOnly && (focused || needsPaste) && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-1 text-center">
            {needsPaste ? "Paste or upload" : "Click to paste"}
          </div>
        )}
      </div>
      {readOnly ? (
        <p className="mt-0.5 text-[10px] text-gray-500">
          {readOnlyCaption ??
            (annexId === "A" && pageIndex === 0
              ? "Edited in layout plan editor above"
              : annexId === "E" && pageIndex === 4
                ? "Edited in Annex E photo-log editor above"
                : "Read-only preview")}
        </p>
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex gap-0.5 mt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 h-6 text-[10px] px-1"
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </Button>
            {hasOverride && !generatedPreviewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                title="Clear pasted image"
                onClick={() => onOverrideChange(pageIndex, null)}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function buildPhotoLogPages(
  annexId: "D" | "F",
  pageIndices: number[],
  previews: string[],
): PageEntry[] {
  if (previews.length > 0) {
    return previews.map((url, subIndex) => ({
      key: `${annexId}-${subIndex}`,
      annexId,
      pageIndex: annexId === "F" ? (pageIndices[subIndex] ?? 5 + subIndex) : 3,
      subIndex,
      generatedPreviewUrl: url,
      readOnly: true,
      readOnlyCaption: "Generated from photo log",
    }));
  }

  if (annexId === "D") {
    return [
      {
        key: "D-0",
        annexId: "D",
        pageIndex: 3,
        subIndex: 0,
        readOnly: true,
        readOnlyCaption: "Add photos to generate preview",
      },
    ];
  }

  return pageIndices.map((pageIndex, subIndex) => ({
    key: `F-${subIndex}`,
    annexId: "F",
    pageIndex,
    subIndex,
    readOnly: true,
    readOnlyCaption: "Add photos to generate preview",
  }));
}

export function AnnexPageEditor({
  selectedIds,
  overrides,
  onOverrideChange,
  headerPreviewUrls = {},
  photoLogAnnexPreviewUrls = { D: [], F: [] },
  photoLogPreviewLoading = false,
}: AnnexPageEditorProps) {
  const allPages: PageEntry[] = selectedIds.flatMap((annexId) => {
    const annex = getAnnexById(annexId);
    if (!annex) return [];

    if (annexId === "D") {
      return buildPhotoLogPages("D", annex.pageIndices, photoLogAnnexPreviewUrls.D);
    }

    if (annexId === "F") {
      return buildPhotoLogPages("F", annex.pageIndices, photoLogAnnexPreviewUrls.F);
    }

    return annex.pageIndices.map((pageIndex, subIndex) => ({
      key: `${annexId}-${pageIndex}`,
      annexId,
      pageIndex,
      subIndex: annexId === "F" ? subIndex : undefined,
      readOnly: (annexId === "A" && pageIndex === 0) || (annexId === "E" && pageIndex === 4),
    }));
  });

  if (selectedIds.length === 0) return null;
  if (allPages.length === 0) return null;

  const totalPages = allPages.length;
  const showPhotoLogLoading =
    photoLogPreviewLoading &&
    selectedIds.some((id) => id === "D" || id === "F");

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <p className="text-sm font-medium">Annex page images</p>
      <p className="text-xs text-gray-500">
        Paste or upload an image for each selected annex page. Annex D and F update
        automatically from the photo log.
      </p>
      <p className="text-xs font-semibold text-gray-700">
        Annexes {selectedIds.join(", ")}
        <span className="font-normal text-gray-500 ml-1">
          ({totalPages} page{totalPages !== 1 ? "s" : ""})
        </span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full items-start">
        {allPages.map(
          ({
            key,
            annexId,
            pageIndex,
            subIndex,
            generatedPreviewUrl,
            readOnly,
            readOnlyCaption,
          }) => (
            <PageCard
              key={key}
              pageIndex={pageIndex}
              annexId={annexId}
              subIndex={subIndex}
              previewUrl={overrides[pageIndex]}
              generatedPreviewUrl={generatedPreviewUrl}
              headerPreviewUrl={headerPreviewUrls[pageIndex]}
              readOnly={readOnly ?? ((annexId === "A" && pageIndex === 0) || (annexId === "E" && pageIndex === 4))}
              readOnlyCaption={readOnlyCaption}
              loading={showPhotoLogLoading && (annexId === "D" || annexId === "F")}
              onOverrideChange={onOverrideChange}
            />
          ),
        )}
      </div>
    </div>
  );
}
