import type { AnalyzeInterviewResponse } from "./interviewAnalysis";

export type ExtractableField =
  | "applianceCallSign"
  | "locationOfFire"
  | "fireInvolved"
  | "methodOfExtinguishment"
  | "damagesSustained"
  | "probableCause"
  | "ignitionSource"
  | "ignitionFuel"
  | "eventsCircumstances"
  | "areaOfFireOrigin"
  | "classification"
  | "handoverOfficer"
  | "handoverNpc";

export type JobStatus =
  | "pending"
  | "processing"
  | "transcribed"
  | "extract_pending"
  | "analyze_pending"
  | "completed"
  | "failed";
export type MessageType = "stop_message" | "field_notes";
export type JobKind = "audio_inference" | "interview_analysis";

export interface InferenceResult {
  fields: Partial<Record<ExtractableField, string>>;
  confidence: Partial<Record<ExtractableField, number>>;
  source: "fake" | "ollama" | "nim" | "regex_fallback";
}

export interface InferenceJob {
  id: string;
  status: JobStatus;
  job_kind?: JobKind;
  message_type: MessageType;
  incident_type_name?: string | null;
  transcript?: string | null;
  result?: InferenceResult | null;
  analysis_result?: AnalyzeInterviewResponse | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ExtractJobRequest {
  text: string;
  messageType: MessageType;
  incidentTypeName?: string;
}

export function isCoordinatorConfigured(): boolean {
  return Boolean(import.meta.env.VITE_COORDINATOR_URL && import.meta.env.VITE_WEB_API_KEY);
}

export function isInferenceConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_COORDINATOR_URL &&
      import.meta.env.VITE_WEB_API_KEY &&
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
