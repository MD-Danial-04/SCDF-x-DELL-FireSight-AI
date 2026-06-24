import { ClipboardCopy, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { InterviewRecordingCard } from "./InterviewRecordingCard";
import { SignaturePad } from "./SignaturePad";
import { LeadingQuestionsPanel } from "./LeadingQuestionsPanel";
import {
  LEADING_QUESTION_SETS,
  type LeadingQuestion,
} from "../constants/leadingQuestions";
import type { AnalyzeInterviewResponse, FollowUpSuggestion } from "../types/interviewAnalysis";
import { isCoordinatorConfigured } from "../types/inference";
import type {
  Interviewee,
  IntervieweeFieldKey,
  InterviewLanguage,
  LeadingQuestionSet,
} from "../types/interviewee";

const DEFAULT_OPEN_SECTIONS = ["personal", "record", "facts"];

interface IntervieweeFieldConfig {
  key: IntervieweeFieldKey;
  label: string;
  multiline?: boolean;
}

const PERSONAL_FIELDS: IntervieweeFieldConfig[] = [
  { key: "name", label: "Name of Interviewee" },
  { key: "nameChinese", label: "Name in Chinese characters (if applicable)" },
  { key: "designation", label: "Designation / Occupation" },
  { key: "nric", label: "NRIC / FIN No." },
  { key: "passportNo", label: "Passport No." },
  { key: "nationality", label: "Nationality" },
  { key: "sex", label: "Sex (Male/Female)" },
  { key: "age", label: "Age" },
  { key: "dateAndPlaceOfBirth", label: "Date and Place of Birth" },
  { key: "maritalStatus", label: "Marital Status" },
  { key: "numberOfChildren", label: "No. of Children" },
  { key: "citizenshipCertNo", label: "Singapore Citizenship Certificate No." },
  { key: "vehicleNo", label: "Vehicle No." },
  { key: "address", label: "Address", multiline: true },
  { key: "placeOfEmployment", label: "Place of Employment" },
];

const CONTACT_FIELDS: IntervieweeFieldConfig[] = [
  { key: "contactHome", label: "Contact No. (Home / Residence)" },
  { key: "contactMobile", label: "Contact No. (Mobile)" },
  { key: "contactOffice", label: "Contact No. (Office)" },
];

const RECORDING_FIELDS: IntervieweeFieldConfig[] = [
  { key: "recordedStartTime", label: "Statement recorded – Start time" },
  { key: "recordedEndTime", label: "Statement recorded – End time" },
  { key: "recordedDate", label: "Statement recorded – Date" },
  { key: "interviewTakenPlace", label: "Interview taken at (place)" },
  { key: "languageSpoken", label: "Language Spoken" },
  { key: "interpretedBy", label: "Interpreted By (if applicable)" },
  { key: "recordedBy", label: "Recorded By (Rank, Name & Signature)" },
];

function IntervieweeFieldGrid({
  fields,
  interviewee,
  onFieldChange,
  extractedKeys,
}: {
  fields: IntervieweeFieldConfig[];
  interviewee: Interviewee;
  onFieldChange: (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string | LeadingQuestionSet | InterviewLanguage
  ) => void;
  extractedKeys?: Set<IntervieweeFieldKey>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.multiline ? "md:col-span-2" : undefined}
        >
          <Label htmlFor={`${interviewee.id}-${field.key}`} className="flex items-center gap-2">
            {field.label}
            {extractedKeys?.has(field.key) ? (
              <span className="text-xs font-normal text-green-600">(auto-filled)</span>
            ) : null}
          </Label>
          {field.multiline ? (
            <Textarea
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) => onFieldChange(interviewee.id, field.key, e.target.value)}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          ) : (
            <Input
              id={`${interviewee.id}-${field.key}`}
              value={interviewee[field.key]}
              onChange={(e) => onFieldChange(interviewee.id, field.key, e.target.value)}
              className="mt-1"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FollowUpSuggestionsPanel({
  intervieweeId,
  followUps,
  interviewLanguage,
  onAddToNotes,
}: {
  intervieweeId: string;
  followUps: FollowUpSuggestion[];
  interviewLanguage: InterviewLanguage;
  onAddToNotes: (text: string) => void;
}) {
  if (followUps.length === 0) return null;

  const showBilingual = interviewLanguage !== "en";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Suggested follow-up questions</p>
        <p className="text-xs text-gray-500 mt-1">
          Ask in the interview language; English is shown for your report notes.
        </p>
      </div>
      <ol className="space-y-3">
        {followUps.map((followUp, index) => (
          <li key={`${intervieweeId}-follow-up-${index}`} className="text-sm text-gray-800">
            <p className="font-medium">{followUp.prompt_conduct}</p>
            {showBilingual && followUp.prompt_conduct !== followUp.prompt ? (
              <p className="text-xs text-gray-400 mt-0.5">{followUp.prompt}</p>
            ) : null}
            {followUp.reason ? (
              <p className="text-xs text-gray-500 mt-0.5">{followUp.reason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(followUp.prompt_conduct);
                    toast.success("Follow-up copied to clipboard");
                  } catch {
                    toast.error("Failed to copy to clipboard");
                  }
                }}
              >
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddToNotes(followUp.prompt)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add English to notes
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IntervieweeLeadingQuestionsSection({
  interviewee,
  activeLeadingQuestions,
  isAnalyzingThis,
  analysisResult,
  onAnalyzeCoverage,
  onAddToNotes,
}: {
  interviewee: Interviewee;
  activeLeadingQuestions: (typeof LEADING_QUESTION_SETS)[number];
  isAnalyzingThis: boolean;
  analysisResult?: AnalyzeInterviewResponse;
  onAnalyzeCoverage: (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[],
    interviewLanguage: InterviewLanguage
  ) => void;
  onAddToNotes: (text: string) => void;
}) {
  const coverageMap = analysisResult
    ? new Map(analysisResult.coverage.map((item) => [item.id, item]))
    : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Compare transcript against the checklist to find gaps.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={
            !interviewee.facts.trim() ||
            isAnalyzingThis ||
            !isCoordinatorConfigured()
          }
          onClick={() =>
            void onAnalyzeCoverage(
              interviewee.id,
              interviewee.facts,
              activeLeadingQuestions.questions,
              interviewee.interviewLanguage
            )
          }
        >
          {isAnalyzingThis ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Analyze coverage
        </Button>
      </div>

      <LeadingQuestionsPanel
        title={activeLeadingQuestions.title}
        questions={activeLeadingQuestions.questions}
        interviewLanguage={interviewee.interviewLanguage}
        coverage={coverageMap}
      />

      {analysisResult ? (
        <FollowUpSuggestionsPanel
          intervieweeId={interviewee.id}
          followUps={analysisResult.follow_ups}
          interviewLanguage={interviewee.interviewLanguage}
          onAddToNotes={onAddToNotes}
        />
      ) : null}
    </>
  );
}

export interface IntervieweePanelProps {
  interviewee: Interviewee;
  canRemove: boolean;
  extractedKeys?: Set<IntervieweeFieldKey>;
  isAnalyzing: boolean;
  analysisResult?: AnalyzeInterviewResponse;
  isGenerating: boolean;
  isGeneratingAll: boolean;
  onFieldChange: (
    intervieweeId: string,
    key: IntervieweeFieldKey,
    value: string | LeadingQuestionSet | InterviewLanguage
  ) => void;
  onLeadingQuestionSetChange: (intervieweeId: string, set: LeadingQuestionSet) => void;
  onAnalyzeCoverage: (
    intervieweeId: string,
    transcript: string,
    questions: LeadingQuestion[],
    interviewLanguage: InterviewLanguage
  ) => void;
  onAddToNotes: (text: string) => void;
  onInterviewLanguageChange: (intervieweeId: string, language: InterviewLanguage) => void;
  onTranscriptsComplete: (intervieweeId: string, original: string, english: string, jobId: string) => void;
  onRecordingStart: (intervieweeId: string, startTime: string) => void;
  onRecordingStop: (intervieweeId: string, endTime: string) => void;
  onFactsChange: (intervieweeId: string, facts: string) => void;
  onRemove: (intervieweeId: string) => void;
  onGenerateStatement?: (intervieweeId: string) => void;
}

export function IntervieweePanel({
  interviewee,
  canRemove,
  extractedKeys,
  isAnalyzing,
  analysisResult,
  isGenerating,
  isGeneratingAll,
  onFieldChange,
  onLeadingQuestionSetChange,
  onAnalyzeCoverage,
  onAddToNotes,
  onInterviewLanguageChange,
  onTranscriptsComplete,
  onRecordingStart,
  onRecordingStop,
  onFactsChange,
  onRemove,
  onGenerateStatement,
}: IntervieweePanelProps) {
  const activeLeadingQuestions = LEADING_QUESTION_SETS.find(
    (option) => option.id === interviewee.leadingQuestionSet
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(interviewee.id)}
          disabled={!canRemove}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Remove witness
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={DEFAULT_OPEN_SECTIONS} className="w-full">
        <AccordionItem value="personal">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Personal details
          </AccordionTrigger>
          <AccordionContent>
            <IntervieweeFieldGrid
              fields={PERSONAL_FIELDS}
              interviewee={interviewee}
              onFieldChange={onFieldChange}
              extractedKeys={extractedKeys}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="contact">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Contact numbers
          </AccordionTrigger>
          <AccordionContent>
            <IntervieweeFieldGrid
              fields={CONTACT_FIELDS}
              interviewee={interviewee}
              onFieldChange={onFieldChange}
              extractedKeys={extractedKeys}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="recording-meta">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Statement recording
          </AccordionTrigger>
          <AccordionContent>
            <IntervieweeFieldGrid
              fields={RECORDING_FIELDS}
              interviewee={interviewee}
              onFieldChange={onFieldChange}
              extractedKeys={extractedKeys}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="leading">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Leading questions
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              {LEADING_QUESTION_SETS.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${interviewee.id}-leading-questions-${option.id}`}
                    checked={interviewee.leadingQuestionSet === option.id}
                    onCheckedChange={(checked) =>
                      onLeadingQuestionSetChange(
                        interviewee.id,
                        checked === true ? option.id : "none"
                      )
                    }
                  />
                  <Label
                    htmlFor={`${interviewee.id}-leading-questions-${option.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>

            {activeLeadingQuestions ? (
              <IntervieweeLeadingQuestionsSection
                interviewee={interviewee}
                activeLeadingQuestions={activeLeadingQuestions}
                isAnalyzingThis={isAnalyzing}
                analysisResult={analysisResult}
                onAnalyzeCoverage={onAnalyzeCoverage}
                onAddToNotes={onAddToNotes}
              />
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="record">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Record interview
          </AccordionTrigger>
          <AccordionContent>
            <InterviewRecordingCard
              title="Record interview"
              description="Select the interview language, record, then review the original and English transcripts below"
              interviewLanguage={interviewee.interviewLanguage}
              onInterviewLanguageChange={(language) =>
                onInterviewLanguageChange(interviewee.id, language)
              }
              onTranscriptsComplete={(original, english, jobId) =>
                onTranscriptsComplete(interviewee.id, original, english, jobId)
              }
              onRecordingStart={(startTime) => onRecordingStart(interviewee.id, startTime)}
              onRecordingStop={(endTime) => onRecordingStop(interviewee.id, endTime)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="facts">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Facts revealed
          </AccordionTrigger>
          <AccordionContent>
            <Tabs defaultValue="english" className="mt-1">
              <TabsList>
                <TabsTrigger value="original">Original</TabsTrigger>
                <TabsTrigger value="english">English</TabsTrigger>
              </TabsList>
              <TabsContent value="original">
                <Textarea
                  id={`${interviewee.id}-facts-original`}
                  value={interviewee.factsOriginal}
                  onChange={(e) =>
                    onFieldChange(interviewee.id, "factsOriginal", e.target.value)
                  }
                  rows={6}
                  placeholder="Transcript in the language the interview was conducted..."
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="english">
                <Textarea
                  id={`${interviewee.id}-facts`}
                  value={interviewee.facts}
                  onChange={(e) => onFactsChange(interviewee.id, e.target.value)}
                  rows={6}
                  placeholder="English translation used for coverage analysis and statement export..."
                  className="font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="signature">
          <AccordionTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:no-underline">
            Signature
          </AccordionTrigger>
          <AccordionContent>
            <Label>Signature of person making statement</Label>
            <SignaturePad
              className="mt-1"
              value={interviewee.signatureDataUrl}
              onChange={(dataUrl) =>
                onFieldChange(interviewee.id, "signatureDataUrl", dataUrl)
              }
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {onGenerateStatement ? (
        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onGenerateStatement(interviewee.id)}
            disabled={isGenerating || isGeneratingAll}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Generate Statement
          </Button>
        </div>
      ) : null}
    </div>
  );
}
