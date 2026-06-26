import { AudioLines, ScanText, Gauge, FileText, Presentation } from "lucide-react";
import { AiPipeline, type AiPipelineStage } from "./AiPipeline";

type ExtractionVariant = "report" | "slides";

function buildStages(variant: ExtractionVariant): AiPipelineStage[] {
  return [
    {
      label: "Transcribing audio",
      sublabel: "Converting speech to text (ASR)",
      Icon: AudioLines,
    },
    {
      label: "Identifying entities",
      sublabel: "Tagging locations, times and call signs (NER)",
      Icon: ScanText,
    },
    {
      label: "Scoring confidence",
      sublabel: "Ranking extracted values",
      Icon: Gauge,
    },
    {
      label: variant === "slides" ? "Assembling slides" : "Assembling report",
      sublabel: "Populating fields for review",
      Icon: variant === "slides" ? Presentation : FileText,
    },
  ];
}

interface ExtractionLoadingScreenProps {
  variant: ExtractionVariant;
  stopMessagePreview?: string;
  title?: string;
}

/**
 * Full-panel animated loading screen shown while NLP extraction runs on mount
 * of the report / slides generation pages. Thin wrapper around `AiPipeline`.
 */
export function ExtractionLoadingScreen({
  variant,
  stopMessagePreview,
  title,
}: ExtractionLoadingScreenProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <AiPipeline
          variant={variant}
          badgeLabel="NLP extraction"
          title={title ?? "Reading your stop message"}
          description="Pulling structured details from the transcript."
          stages={buildStages(variant)}
          previewText={stopMessagePreview}
        />
      </div>
    </div>
  );
}
