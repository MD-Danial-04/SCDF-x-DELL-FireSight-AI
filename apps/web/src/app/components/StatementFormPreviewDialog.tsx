import { useCallback, useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { Download } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { DocxPreviewSurface } from "./DocxPreviewSurface";
import { useDocxPreviewFitWithZoom } from "../hooks/useDocxPreviewFitWithZoom";
import type { Interviewee } from "../types/interviewee";

interface StatementFormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewee: Interviewee;
  getBlob: () => Promise<Blob>;
  onDownload: () => void;
}

export function StatementFormPreviewDialog({
  open,
  onOpenChange,
  interviewee,
  getBlob,
  onDownload,
}: StatementFormPreviewDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const getPreviewElements = useCallback(() => {
    const viewport = viewportRef.current;
    const host = hostRef.current;
    const scaler = scalerRef.current;
    if (!viewport || !host || !scaler) return null;
    return { viewport, host, scaler };
  }, []);

  const { scheduleFit } = useDocxPreviewFitWithZoom(getPreviewElements, viewportRef, {
    active: open && previewVersion > 0,
    resetKey: previewVersion,
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setIsRendering(true);
    setPreviewVersion(0);

    const run = async () => {
      let blob: Blob;
      try {
        blob = await getBlob();
      } catch (err) {
        if (cancelled) return;
        console.error("Statement preview generation failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate the statement form."
        );
        setIsRendering(false);
        return;
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        if (hostRef.current) break;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (cancelled) return;
      if (!hostRef.current) {
        setError("Preview panel is not ready yet. Try again.");
        setIsRendering(false);
        return;
      }

      hostRef.current.innerHTML = "";
      try {
        await renderAsync(blob, hostRef.current, undefined, {
          className: "docx-preview",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
        });
        if (cancelled) return;
        const elements = getPreviewElements();
        if (elements) scheduleFit();
        setPreviewVersion((v) => v + 1);
      } catch (err) {
        if (cancelled) return;
        console.error("Statement preview failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Statement preview failed to render."
        );
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, getBlob, getPreviewElements, scheduleFit]);

  const intervieweeName = interviewee.name.trim() || "Interviewee";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl xl:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Statement form preview</DialogTitle>
          <DialogDescription>
            {intervieweeName} — this matches the document that will be downloaded.
          </DialogDescription>
        </DialogHeader>

        <DocxPreviewSurface
          viewportRef={viewportRef}
          scalerRef={scalerRef}
          hostRef={hostRef}
          isRendering={isRendering}
          error={error}
        />

        <DialogFooter>
          <Button onClick={onDownload} disabled={isRendering}>
            <Download className="mr-2 h-4 w-4" />
            Download DOCX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
