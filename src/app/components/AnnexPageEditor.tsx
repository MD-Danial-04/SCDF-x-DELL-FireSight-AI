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
    <div className="flex flex-col w-[140px] shrink-0">
      <p className="text-xs text-gray-600 mb-1 truncate" title={label}>
        {annexId === "F" && subIndex !== undefined
          ? `F-${subIndex + 1}`
          : `Page ${pageIndex}`}
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
          <div className="flex flex-col items-center justify-center h-full p-2 text-center text-xs text-amber-700 bg-amber-50">
            <ImagePlus className="w-6 h-6 mb-1 opacity-60" />
            Paste image required
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
      <div className="flex gap-1 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs px-1"
          onClick={() => fileRef.current?.click()}
        >
          Upload
        </Button>
        {hasOverride && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Clear pasted image"
            onClick={() => onOverrideChange(pageIndex, null)}
          >
            <X className="w-3 h-3" />
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
  if (selectedIds.length === 0) return null;

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <p className="text-sm font-medium">Annex page images</p>
      <p className="text-xs text-gray-500">
        Focus a card and paste (Ctrl+V) to replace a slide, or upload an image.
      </p>
      {selectedIds.map((annexId) => {
        const annex = getAnnexById(annexId);
        if (!annex) return null;
        return (
          <div key={annexId}>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Annex {annexId}
              <span className="font-normal text-gray-500 ml-1">
                ({annex.pageIndices.length} page{annex.pageIndices.length > 1 ? "s" : ""})
              </span>
            </p>
            <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
              {annex.pageIndices.map((pageIndex, subIndex) => (
                <PageCard
                  key={pageIndex}
                  pageIndex={pageIndex}
                  annexId={annexId}
                  subIndex={annexId === "F" ? subIndex : undefined}
                  previewUrl={overrides[pageIndex]}
                  onOverrideChange={onOverrideChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
