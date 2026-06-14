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

interface AnnexSelectorProps {
  selectedIds: string[];
  onChange: (selectedIds: string[], attachmentList: string) => void;
  overrides?: Record<number, string>;
  onOverrideChange?: (pageIndex: number, blob: Blob | null) => void;
  onEnsureAnnexSelected?: (annexId: string) => void;
}

export function AnnexSelector({
  selectedIds,
  onChange,
  overrides = {},
  onOverrideChange,
  onEnsureAnnexSelected,
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
          onOverrideChange={onOverrideChange}
        />
      )}
      {onOverrideChange && (
        <AnnexPageEditor
          selectedIds={selectedIds}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
          onEnsureAnnexSelected={onEnsureAnnexSelected}
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
