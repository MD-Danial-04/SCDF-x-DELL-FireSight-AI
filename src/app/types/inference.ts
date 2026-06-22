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
  | "completed"
  | "failed";
export type MessageType = "stop_message" | "field_notes";

export interface InferenceResult {
  fields: Partial<Record<ExtractableField, string>>;
  confidence: Partial<Record<ExtractableField, number>>;
  source: "fake" | "ollama" | "nim" | "regex_fallback";
}

export interface InferenceJob {
  id: string;
  status: JobStatus;
  message_type: MessageType;
  incident_type_name?: string | null;
  transcript?: string | null;
  result?: InferenceResult | null;
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

export function isInferenceConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_COORDINATOR_URL &&
      import.meta.env.VITE_WEB_API_KEY &&
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
