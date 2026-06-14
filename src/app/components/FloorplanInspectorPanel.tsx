import { Eye, EyeOff, Minus, Move, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type {
  FloorplanAmendment,
  FloorplanGeneratedElement,
  FloorplanLayer,
} from "../lib/floorplanEditor";

const TEXT_FONT_OPTIONS = [
  "Arial, sans-serif",
  "Georgia, serif",
  "\"Times New Roman\", serif",
  "\"Trebuchet MS\", sans-serif",
  "Verdana, sans-serif",
  "\"Courier New\", monospace",
];
const TEXT_STYLE_OPTIONS = {
  normal: "400",
  bold: "700",
} as const;

function normalizeColorInput(value: string | undefined, fallback: string) {
  if (!value || value === "none" || value === "transparent") return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function isTransparentColor(value: string | undefined) {
  return value === "none" || value === "transparent";
}

interface FloorplanGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface FloorplanInspectorPanelProps {
  selectedLayer: FloorplanLayer;
  selectedAmendment: FloorplanAmendment;
  selectedTextValue: string | null;
  generatedElement: FloorplanGeneratedElement | null;
  isShapeSelection: boolean;
  isRectSelection: boolean;
  selectedGroup: FloorplanGroup | null;
  showCloseButton?: boolean;
  onClose?: () => void;
  updateSelectedAmendment: (patch: FloorplanAmendment) => void;
  setGeneratedElements: React.Dispatch<React.SetStateAction<FloorplanGeneratedElement[]>>;
  updateGeneratedElementWithoutHistory: (
    elementId: string,
    updater: (element: FloorplanGeneratedElement) => FloorplanGeneratedElement,
  ) => void;
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  removeGeneratedElement: () => void;
}

export function FloorplanInspectorPanel({
  selectedLayer,
  selectedAmendment,
  selectedTextValue,
  generatedElement,
  isShapeSelection,
  isRectSelection,
  selectedGroup,
  showCloseButton,
  onClose,
  updateSelectedAmendment,
  setGeneratedElements,
  updateGeneratedElementWithoutHistory,
  setSelectedGroupId,
  removeGeneratedElement,
}: FloorplanInspectorPanelProps) {
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-foreground">
            {selectedLayer.isText
              ? selectedTextValue
              : selectedAmendment.label || selectedLayer.label}
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {selectedLayer.isGenerated ? `Generated ${selectedLayer.tagName}` : selectedLayer.tagName}
          </p>
        </div>
        {showCloseButton && onClose && (
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {!selectedLayer.isText && (
          <div className="space-y-2">
            <Label htmlFor="layer-label">Layer label</Label>
            <Input
              id="layer-label"
              value={selectedAmendment.label ?? selectedLayer.label}
              onChange={(event) => {
                updateSelectedAmendment({ label: event.target.value });
                if (generatedElement) {
                  setGeneratedElements((current) =>
                    current.map((element) =>
                      element.id === generatedElement.id ? { ...element, label: event.target.value } : element,
                    ),
                  );
                }
              }}
            />
          </div>
        )}

        {selectedLayer.isText && (
          <>
            <div className="space-y-2">
              <Label>Text content</Label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                Double-click the text on the canvas to edit the words directly.
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-size">Font size</Label>
              <Input
                id="font-size"
                value={selectedAmendment.fontSize ?? ""}
                placeholder="28"
                onChange={(event) => updateSelectedAmendment({ fontSize: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-family">Font</Label>
              <Select
                value={selectedAmendment.fontFamily ?? generatedElement?.fontFamily ?? "Arial, sans-serif"}
                onValueChange={(value) => {
                  updateSelectedAmendment({ fontFamily: value });
                  if (generatedElement) {
                    updateGeneratedElementWithoutHistory(generatedElement.id, (element) => ({
                      ...element,
                      fontFamily: value,
                    }));
                  }
                }}
              >
                <SelectTrigger id="font-family">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font.split(",")[0]?.replace(/"/g, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-color">Text color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="text-color"
                  type="color"
                  className="w-16 p-1"
                  value={normalizeColorInput(selectedAmendment.fill ?? generatedElement?.fill, "#0f172a")}
                  onChange={(event) => updateSelectedAmendment({ fill: event.target.value })}
                />
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={isTransparentColor(selectedAmendment.fill ?? generatedElement?.fill)}
                    onChange={(event) =>
                      updateSelectedAmendment({
                        fill: event.target.checked ? "transparent" : "#0f172a",
                      })
                    }
                  />
                  Transparent
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text style</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedAmendment.fontWeight === TEXT_STYLE_OPTIONS.bold ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateSelectedAmendment({
                      fontWeight:
                        selectedAmendment.fontWeight === TEXT_STYLE_OPTIONS.bold
                          ? TEXT_STYLE_OPTIONS.normal
                          : TEXT_STYLE_OPTIONS.bold,
                    })
                  }
                >
                  Bold
                </Button>
                <Button
                  type="button"
                  variant={selectedAmendment.fontStyle === "italic" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateSelectedAmendment({
                      fontStyle: selectedAmendment.fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                >
                  Italic
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="offset-x">Offset X</Label>
          <Input
            id="offset-x"
            value={String(selectedAmendment.translateX ?? 0)}
            onChange={(event) =>
              updateSelectedAmendment({ translateX: Number.parseFloat(event.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offset-y">Offset Y</Label>
          <Input
            id="offset-y"
            value={String(selectedAmendment.translateY ?? 0)}
            onChange={(event) =>
              updateSelectedAmendment({ translateY: Number.parseFloat(event.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rotation">Rotation</Label>
          <Input
            id="rotation"
            value={String(selectedAmendment.rotation ?? generatedElement?.rotation ?? 0)}
            onChange={(event) => {
              const rotation = Number.parseFloat(event.target.value) || 0;
              updateSelectedAmendment({ rotation });
            }}
          />
        </div>

        {isShapeSelection && (
          <>
            <div className="space-y-2">
              <Label htmlFor="shape-fill">Shape color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="shape-fill"
                  type="color"
                  className="w-16 p-1"
                  value={normalizeColorInput(selectedAmendment.fill ?? generatedElement?.fill, "#ffffff")}
                  onChange={(event) => {
                    updateSelectedAmendment({ fill: event.target.value });
                    if (generatedElement) {
                      setGeneratedElements((current) =>
                        current.map((element) =>
                          element.id === generatedElement.id ? { ...element, fill: event.target.value } : element,
                        ),
                      );
                    }
                  }}
                />
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={isTransparentColor(selectedAmendment.fill ?? generatedElement?.fill)}
                    onChange={(event) => {
                      const fill = event.target.checked
                        ? "transparent"
                        : normalizeColorInput(generatedElement?.fill, "#ffffff");
                      updateSelectedAmendment({ fill });
                      if (generatedElement) {
                        setGeneratedElements((current) =>
                          current.map((element) =>
                            element.id === generatedElement.id ? { ...element, fill } : element,
                          ),
                        );
                      }
                    }}
                  />
                  Transparent
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shape-stroke">Border color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="shape-stroke"
                  type="color"
                  className="w-16 p-1"
                  value={normalizeColorInput(selectedAmendment.stroke ?? generatedElement?.stroke, "#0f172a")}
                  onChange={(event) => {
                    updateSelectedAmendment({ stroke: event.target.value });
                    if (generatedElement) {
                      setGeneratedElements((current) =>
                        current.map((element) =>
                          element.id === generatedElement.id ? { ...element, stroke: event.target.value } : element,
                        ),
                      );
                    }
                  }}
                />
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={isTransparentColor(selectedAmendment.stroke ?? generatedElement?.stroke)}
                    onChange={(event) => {
                      const stroke = event.target.checked
                        ? "transparent"
                        : normalizeColorInput(generatedElement?.stroke, "#0f172a");
                      updateSelectedAmendment({ stroke });
                      if (generatedElement) {
                        setGeneratedElements((current) =>
                          current.map((element) =>
                            element.id === generatedElement.id ? { ...element, stroke } : element,
                          ),
                        );
                      }
                    }}
                  />
                  Transparent
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shape-stroke-width">Border thickness</Label>
              <Input
                id="shape-stroke-width"
                type="number"
                min="0"
                step="1"
                value={String(selectedAmendment.strokeWidth ?? generatedElement?.strokeWidth ?? 4)}
                onChange={(event) => {
                  const strokeWidth = Math.max(0, Number.parseFloat(event.target.value) || 0);
                  updateSelectedAmendment({ strokeWidth });
                  if (generatedElement) {
                    setGeneratedElements((current) =>
                      current.map((element) =>
                        element.id === generatedElement.id ? { ...element, strokeWidth } : element,
                      ),
                    );
                  }
                }}
              />
            </div>
          </>
        )}

        {isRectSelection && (
          <>
            <div className="space-y-2">
              <Label htmlFor="corner-radius-x">Corner radius X</Label>
              <Input
                id="corner-radius-x"
                value={String(selectedAmendment.cornerRadiusX ?? 0)}
                onChange={(event) =>
                  updateSelectedAmendment({
                    cornerRadiusX: Math.max(0, Number.parseFloat(event.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corner-radius-y">Corner radius Y</Label>
              <Input
                id="corner-radius-y"
                value={String(selectedAmendment.cornerRadiusY ?? selectedAmendment.cornerRadiusX ?? 0)}
                onChange={(event) =>
                  updateSelectedAmendment({
                    cornerRadiusY: Math.max(0, Number.parseFloat(event.target.value) || 0),
                  })
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => updateSelectedAmendment({ hidden: !(selectedAmendment.hidden ?? false) })}
        >
          {(selectedAmendment.hidden ?? false) ? (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Show layer
            </>
          ) : (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide layer
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => setSelectedGroupId(null)}>
          <Move className="mr-2 h-4 w-4" />
          Move single node
        </Button>
        {selectedGroup && (
          <Badge variant="secondary" className="bg-brand-slides-muted text-brand-slides border-blue-100">
            Group move active: {selectedGroup.name}
          </Badge>
        )}
        {generatedElement && (
          <Button type="button" variant="outline" onClick={removeGeneratedElement}>
            <Minus className="mr-2 h-4 w-4" />
            Remove shape
          </Button>
        )}
      </div>
    </>
  );
}
