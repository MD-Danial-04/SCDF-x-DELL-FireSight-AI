import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { ImagePlus, X } from "lucide-react";
import { getAnnexById } from "../constants/annexDefinitions";
import { getPageLabel, hasDefaultPageAsset } from "../constants/annexPageDefaults";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";

interface AnnexPageEditorProps {
  selectedIds: string[];
  overrides: Record<number, string>;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
}

function PageCard({
  pageIndex,
  annexId,
  subIndex,
  previewUrl,
  onOverrideChange,
}: {
  pageIndex: number;
  annexId: string;
  subIndex?: number;
  previewUrl?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
}) {
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const defaultUrl = getDefaultPagePreviewUrl(pageIndex);
  const displayUrl = previewUrl ?? defaultUrl;
  const hasOverride = Boolean(previewUrl);
  const needsPaste = !hasDefaultPageAsset(pageIndex) && !hasOverride;

  const applyImageBlob = (blob: Blob | null) => {
    if (!blob) return;
    if (!blob.type.startsWith("image/")) return;
    onOverrideChange(pageIndex, blob);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
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

  return (
    <div className="flex flex-col w-full min-w-0">
      <p className="text-[10px] text-gray-600 mb-0.5 truncate" title={label}>
        Annex {annexId}
        {annexId === "F" && subIndex !== undefined
          ? ` · F-${subIndex + 1}`
          : ` · Page ${pageIndex}`}
      </p>
      <div
        tabIndex={0}
        role="button"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={handlePaste}
        onClick={() => fileRef.current?.click()}
        className={`relative rounded-md border-2 overflow-hidden aspect-[719/1058] bg-gray-100 cursor-pointer transition-colors ${
          focused ? "border-red-500 ring-2 ring-red-200" : "border-gray-200 hover:border-gray-300"
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
        {(focused || needsPaste) && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-1 text-center">
            {needsPaste ? "Paste or upload" : "Click to paste"}
          </div>
        )}
      </div>
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
        {hasOverride && (
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
    </div>
  );
}

export function AnnexPageEditor({
  selectedIds,
  overrides,
  onOverrideChange,
}: AnnexPageEditorProps) {
  const allPages = selectedIds.flatMap((annexId) => {
    const annex = getAnnexById(annexId);
    if (!annex) return [];
    return annex.pageIndices.map((pageIndex, subIndex) => ({
      annexId,
      pageIndex,
      subIndex: annexId === "F" ? subIndex : undefined,
    }));
  }).filter(({ annexId, pageIndex }) => !(annexId === "A" && pageIndex === 0));

  if (selectedIds.length === 0) return null;
  if (allPages.length === 0) return null;

  const totalPages = allPages.length;

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <p className="text-sm font-medium">Annex page images</p>
      <p className="text-xs text-gray-500">
        Focus a card and paste (Ctrl+V) to replace a slide, or upload an image.
      </p>
      <p className="text-xs font-semibold text-gray-700">
        Annexes {selectedIds.join(", ")}
        <span className="font-normal text-gray-500 ml-1">
          ({totalPages} page{totalPages !== 1 ? "s" : ""})
        </span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full items-start">
        {allPages.map(({ annexId, pageIndex, subIndex }) => (
          <PageCard
            key={pageIndex}
            pageIndex={pageIndex}
            annexId={annexId}
            subIndex={subIndex}
            previewUrl={overrides[pageIndex]}
            onOverrideChange={onOverrideChange}
          />
        ))}
      </div>
    </div>
  );
}
