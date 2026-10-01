import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AiPipeline, AI_PIPELINE_PRESETS, type AiPipelineKind } from "./AiPipeline";
import { cn } from "./ui/utils";

interface AiProcessingDialogProps {
  open: boolean;
  kind: AiPipelineKind;
  title?: string;
  description?: string;
  previewText?: string;
  /** Optional batch progress (e.g. photo analysis). */
  progress?: { done: number; total: number };
}

/**
 * Blocking, non-dismissable popup that shows the animated AI pipeline while an
 * extraction/analysis/transcription job runs. Cannot be closed by the user; the
 * parent dismisses it by flipping `open` to false when the job settles.
 */
export function AiProcessingDialog({
  open,
  kind,
  title,
  description,
  previewText,
  progress,
}: AiProcessingDialogProps) {
  const preset = AI_PIPELINE_PRESETS[kind];

  const progressLabel =
    progress && progress.total > 1
      ? `${preset.variant === "report" && kind === "photo-analysis" ? "Photo" : "Item"} ${Math.min(
          progress.done + 1,
          progress.total,
        )} of ${progress.total}`
      : undefined;

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          )}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] duration-200 sm:max-w-md",
          )}
        >
          {/* Visually-hidden title/description for accessibility (Radix requires a title). */}
          <DialogPrimitive.Title className="sr-only">
            {title ?? preset.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description ?? preset.description}
          </DialogPrimitive.Description>

          <AiPipeline
            variant={preset.variant}
            badgeLabel={preset.badgeLabel}
            title={title ?? preset.title}
            description={description ?? preset.description}
            stages={preset.stages}
            previewText={previewText}
            progressLabel={progressLabel}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
