import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";
import { imageBlobToAnnexTemplatePngBlob } from "../lib/svgToAnnexPng";

interface AnnexImageUploadEditorProps {
  annexId: string;
  pageIndex: number;
  incidentNo?: string;
  locationOfFire?: string;
  previewUrl?: string;
  onOverrideChange: (pageIndex: number, blob: Blob | null) => void;
}

export function AnnexImageUploadEditor({
  annexId,
  pageIndex,
  incidentNo,
  locationOfFire,
  previewUrl,
  onOverrideChange,
}: AnnexImageUploadEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const defaultUrl = getDefaultPagePreviewUrl(pageIndex);
  const displayUrl = previewUrl ?? defaultUrl ?? undefined;
  const hasOverride = Boolean(previewUrl);

  const applyImageBlob = async (blob: Blob | null) => {
    if (!blob || !blob.type.startsWith("image/")) return;
    setBusy(true);
    setError(null);
    try {
      const composited = await imageBlobToAnnexTemplatePngBlob(
        blob,
        { incidentNo, locationOfFire },
        { templatePageIndex: pageIndex },
      );
      onOverrideChange(pageIndex, composited);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare the image.");
    } finally {
      setBusy(false);
    }
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
          void applyImageBlob(file);
          return;
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void applyImageBlob(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Upload or paste an image to place in the centre of the Annex {annexId} template. The
        header, legend, and footer are kept automatically.
      </p>

      <div
        tabIndex={0}
        role="button"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={handlePaste}
        onClick={() => fileRef.current?.click()}
        className={`relative mx-auto w-full max-w-[280px] cursor-pointer overflow-hidden rounded-md border-2 bg-gray-100 transition-colors aspect-[719/1058] ${
          focused ? "border-red-500 ring-2 ring-red-200" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={`Annex ${annexId} preview`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-2 text-center text-xs text-amber-700">
            <ImagePlus className="mb-1 h-5 w-5 opacity-60" />
            Upload or paste an image
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        )}
        {(focused || !hasOverride) && !busy && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] text-white">
            {hasOverride ? "Click to replace" : "Click to upload or paste"}
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

      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Upload image
        </Button>
        {hasOverride && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOverrideChange(pageIndex, null)}
            disabled={busy}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
