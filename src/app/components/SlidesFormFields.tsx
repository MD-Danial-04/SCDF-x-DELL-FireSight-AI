import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import type { ActivationSlideData, ActivationSlideFieldKey } from "../types/activationSlides";
import {
  SLIDE_EXTRACTABLE_KEYS,
  SLIDE_FORM_SECTIONS,
  getDefaultOpenSlideSections,
  type SlideFormFieldConfig,
} from "../constants/slideFormSections";

interface SlidesFormFieldsProps {
  fields: ActivationSlideData;
  extractedKeys: Set<string>;
  onChange: (key: ActivationSlideFieldKey, value: string) => void;
}

function SlideField({
  config,
  value,
  onChange,
  extracted,
}: {
  config: SlideFormFieldConfig;
  value: string;
  onChange: (key: ActivationSlideFieldKey, value: string) => void;
  extracted?: boolean;
}) {
  const { key, label, inputType = "text", placeholder } = config;
  const inputId = `slide-${key}`;

  return (
    <div className={config.colSpan === 2 ? "md:col-span-2" : undefined}>
      <Label htmlFor={inputId} className="flex items-center gap-2">
        {label}
        {extracted && (
          <span className="text-xs font-normal text-green-600">(auto-filled)</span>
        )}
      </Label>
      {inputType === "textarea" ? (
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1"
        />
      ) : (
        <Input
          id={inputId}
          type={inputType === "text" ? "text" : inputType}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={placeholder}
          className="mt-1"
        />
      )}
    </div>
  );
}

export function SlidesFormFields({ fields, extractedKeys, onChange }: SlidesFormFieldsProps) {
  const isExtracted = (config: SlideFormFieldConfig) =>
    (config.extractable || SLIDE_EXTRACTABLE_KEYS.includes(config.key)) &&
    extractedKeys.has(config.key);

  const countAutoFilled = (sectionId: string) => {
    const section = SLIDE_FORM_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;
    return section.fields.filter((f) => extractedKeys.has(f.key)).length;
  };

  return (
    <Accordion type="multiple" defaultValue={getDefaultOpenSlideSections()} className="w-full">
      {SLIDE_FORM_SECTIONS.map((section) => {
        const autoCount = countAutoFilled(section.id);
        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <span className="flex flex-wrap items-center gap-2">
                {section.title}
                {autoCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal bg-emerald-50 text-emerald-800 border-emerald-200">
                    {autoCount} auto-filled
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <p className="text-xs text-muted-foreground mb-4">{section.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.fields.map((config) => (
                  <SlideField
                    key={config.key}
                    config={config}
                    value={fields[config.key]}
                    onChange={onChange}
                    extracted={isExtracted(config)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
