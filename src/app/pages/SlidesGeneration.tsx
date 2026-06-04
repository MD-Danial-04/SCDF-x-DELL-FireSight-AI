import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { useNavigate } from "react-router";
import {
  X,
  FileImage,
  Download,
  Loader2,
  Mail,
  Send,
  Camera,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBanner } from "../components/StatusBanner";
import { SlidesFormFields } from "../components/SlidesFormFields";
import { ActivationSlidesPreview } from "../components/ActivationSlidesPreview";
import { useOptionalReportSession } from "../context/ReportSessionContext";
import { getIncidentCategoryLabel } from "../constants/incidentTemplates";
import { extractSlideFields, mergeSlideFields } from "../lib/extractSlideFields";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Progress } from "../components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  createEmptySlideData,
  type ActivationSlideData,
  type ActivationSlideFieldKey,
} from "../types/activationSlides";
import {
  downloadActivationSlides,
  generateActivationSlidesPptx,
  getActivationSlidesFilename,
} from "../lib/generateActivationSlides";

interface PhotoField {
  id: string;
  label: string;
  preview?: string;
}

const INITIAL_PHOTO_FIELDS: PhotoField[] = [
  { id: "overview", label: "Overview" },
  { id: "main-panel", label: "Main Fire Alarm Panel" },
  { id: "sub-panel", label: "Sub Fire Alarm Panel" },
  { id: "fault-overview", label: "Overview of the fault at fire safety measure" },
  { id: "fault-closeup", label: "Close up of the fault at fire safety measure" },
];

interface SlidesGenerationProps {
  onBack?: () => void;
}

export function SlidesGeneration({ onBack }: SlidesGenerationProps) {
  const navigate = useNavigate();
  const session = useOptionalReportSession();
  const stopMessage = session?.stopMessage ?? "";
  const fieldNotes = session?.fieldNotes ?? "";
  const incidentType = session?.incidentType ?? null;
  const demoPremisesOwner = session?.premisesOwner ?? "";
  const demoPremisesUen = session?.premisesUen ?? "";

  const [slideData, setSlideData] = useState<ActivationSlideData>(() => createEmptySlideData());
  const [extractedKeys, setExtractedKeys] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedSlides, setGeneratedSlides] = useState(false);
  const [slidesBlob, setSlidesBlob] = useState<Blob | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [photoFields, setPhotoFields] = useState<PhotoField[]>(INITIAL_PHOTO_FIELDS);
  const previewViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const uploadedPhotoCount = photoFields.filter((f) => f.preview).length;
  const slidesFilename = getActivationSlidesFilename(slideData.incidentNo);

  useEffect(() => {
    const extracted = extractSlideFields(
      stopMessage,
      incidentType?.name,
      fieldNotes,
      slideData.dutyDate
    );
    if (demoPremisesOwner.trim()) extracted.premisesOwner = demoPremisesOwner.trim();
    if (demoPremisesUen.trim()) extracted.premisesUen = demoPremisesUen.trim();

    const keys = new Set(
      Object.entries(extracted)
        .filter(([, v]) => v && String(v).trim())
        .map(([k]) => k)
    );
    setExtractedKeys(keys);
    if (keys.size > 0) {
      setSlideData((prev) => mergeSlideFields(prev, extracted));
    }
  }, [
    stopMessage,
    fieldNotes,
    incidentType?.name,
    slideData.dutyDate,
    demoPremisesOwner,
    demoPremisesUen,
  ]);

  const updateField = (key: ActivationSlideFieldKey, value: string) => {
    setSlideData((prev) => ({ ...prev, [key]: value }));
  };

  const stopPreview = useMemo(
    () => (stopMessage.length > 120 ? `${stopMessage.slice(0, 120)}…` : stopMessage),
    [stopMessage]
  );

  const autoFilledCount = extractedKeys.size;

  const handlePhotoUpload = (fieldId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoFields((prev) =>
        prev.map((field) =>
          field.id === fieldId
            ? { ...field, preview: e.target?.result as string }
            : field
        )
      );
      toast.success("Photo uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (fieldId: string) => {
    setPhotoFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, preview: undefined } : field
      )
    );
    toast.success("Photo removed");
  };

  const handleGenerateSlides = async () => {
    if (uploadedPhotoCount === 0) {
      toast.warning("No photos uploaded — placeholders will appear on slide 2");
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGeneratedSlides(false);
    setSlidesBlob(null);

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 15, 90));
    }, 150);

    try {
      const blob = await generateActivationSlidesPptx(slideData, photoFields);
      clearInterval(progressInterval);
      setGenerationProgress(100);
      setSlidesBlob(blob);
      setGeneratedSlides(true);
      toast.success("Presentation slides generated successfully");
    } catch (err) {
      console.error(err);
      clearInterval(progressInterval);
      toast.error("Failed to generate slides");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!slidesBlob) {
      toast.error("Generate slides first");
      return;
    }
    downloadActivationSlides(slidesBlob, slidesFilename);
    toast.success("Presentation downloaded");
  };

  const handleEmailSupervisor = () => {
    setShowEmailDialog(true);
  };

  const handleSendEmail = () => {
    toast.success("Slides sent to supervisor via email");
    setShowEmailDialog(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePrevious = () => {
    if (onBack) onBack();
    else navigate("/incident");
  };

  const slideContentCard = (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Slide content</CardTitle>
        <CardDescription>
          {stopMessage
            ? "Fields marked auto-filled were parsed from your stop message. Edit as needed, then generate slides."
            : "Expand each section to enter details before generating slides."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <SlidesFormFields
          fields={slideData}
          extractedKeys={extractedKeys}
          onChange={updateField}
        />

        <Accordion type="multiple" defaultValue={[]} className="w-full">
          <AccordionItem value="photos">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                Photo Documentation
                {uploadedPhotoCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {uploadedPhotoCount} uploaded
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <p className="text-xs text-muted-foreground mb-4">
                Upload photos for each required category
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {photoFields.map((field) => (
                  <div key={field.id} className="border rounded-lg p-4">
                    <Label className="font-semibold">{field.label}</Label>
                    {field.preview ? (
                      <div className="mt-2 relative">
                        <img
                          src={field.preview}
                          alt={field.label}
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => handleRemovePhoto(field.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <input
                          type="file"
                          id={`photo-${field.id}`}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(field.id, e)}
                        />
                        <label htmlFor={`photo-${field.id}`} className="cursor-pointer">
                          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors bg-muted/40">
                            <Camera className="w-8 h-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">Click to upload photo</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );

  const generateSlidesCard = (
    <Card className="rounded-xl shadow-sm border-brand-slides/20 bg-brand-slides-muted/30">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-medium">Ready to generate slides</h4>
            <p className="text-sm text-muted-foreground mt-1">
              SCDF template: Information slide + photo row (with grid background)
            </p>
          </div>
          <Button
            variant="slides"
            onClick={handleGenerateSlides}
            disabled={isGenerating}
            className="shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileImage className="mr-2 h-4 w-4" />
                Generate Slides
              </>
            )}
          </Button>
        </div>
        {isGenerating && (
          <div className="mt-4">
            <Progress value={generationProgress} className="h-2" />
            <p className="text-xs text-gray-600 mt-2">Building PowerPoint presentation...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const downloadSection =
    generatedSlides && slidesBlob ? (
      <>
        <StatusBanner variant="success" title="Presentation slides generated">
          <p>Your presentation is ready for download or email.</p>
        </StatusBanner>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-brand-slides-muted rounded-xl flex items-center justify-center">
                  <FileImage className="w-8 h-8 text-brand-slides" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{slidesFilename}</p>
                  <p className="text-sm text-gray-600">
                    PowerPoint Presentation • 2 slides • {formatFileSize(slidesBlob.size)}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">Info table</Badge>
                    <Badge variant="secondary">{uploadedPhotoCount} photos on slide 2</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGenerateSlides}
                disabled={isGenerating}
                variant="outline"
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate PPTX after edits
              </Button>
              <div className="flex gap-3">
                <Button variant="slides" onClick={handleDownload} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download Locally
                </Button>
                <Button onClick={handleEmailSupervisor} variant="outline" className="flex-1">
                  <Mail className="mr-2 h-4 w-4" />
                  Email to Supervisor
                </Button>
              </div>
              <Button variant="outline" className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Send via Outlook Integration
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    ) : null;

  const previewCard = (
    <Card className="flex flex-col rounded-xl shadow-sm xl:sticky xl:top-20 xl:self-start">
      <CardHeader>
        <CardTitle className="text-lg">Slide preview</CardTitle>
        <CardDescription>Live preview — updates as you edit fields</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={previewViewportRef}
          className="slide-preview-viewport flex items-center justify-center overflow-hidden border rounded-xl bg-muted/40 h-[min(480px,50vh)] xl:h-[min(calc(100vh-7rem),720px)]"
        >
          <ActivationSlidesPreview
            viewportRef={previewViewportRef}
            data={slideData}
            photos={photoFields}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activation slides"
        description="Review auto-filled fields from your stop message, then complete details and upload photos."
        actions={
          incidentType ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline" className="font-medium">
                {getIncidentCategoryLabel(incidentType.category)}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-brand-slides-muted text-brand-slides border-blue-100"
              >
                {incidentType.name}
              </Badge>
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
      </div>

      {stopMessage ? (
        <StatusBanner variant="success" title="Stop message captured">
          <p className="font-mono text-xs sm:text-sm break-words">{stopPreview}</p>
          {autoFilledCount > 0 && (
            <p className="mt-2 text-sm">
              {autoFilledCount} field{autoFilledCount === 1 ? "" : "s"} auto-filled below — edit as needed.
            </p>
          )}
        </StatusBanner>
      ) : (
        <StatusBanner variant="info" title="Slide content">
          <p>Enter operational details and upload photos. Fields can be auto-filled when opened from a stop message.</p>
        </StatusBanner>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {slideContentCard}
          {!generatedSlides && generateSlidesCard}
          {downloadSection}
        </div>
        {previewCard}
      </div>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Slides to Supervisor</DialogTitle>
            <DialogDescription>Enter email details to send the presentation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input id="email-to" type="email" defaultValue="sarah.lim@scdf.gov.sg" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                defaultValue={`Activation Slides - ${slideData.incidentNo}`}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                rows={4}
                className="mt-1"
                defaultValue="Dear Sir/Madam,&#10;&#10;Please find attached the activation slides for this incident.&#10;&#10;Best regards"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancel
              </Button>
              <Button variant="slides" onClick={handleSendEmail}>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
