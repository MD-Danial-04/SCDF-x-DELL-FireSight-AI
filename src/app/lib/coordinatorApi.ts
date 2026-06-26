import type { ExtractJobRequest, InferenceJob, InterviewLanguage, MessageType } from "../types/inference";
import type { InterviewQuestionInput } from "../types/interviewAnalysis";

const coordinatorUrl = () =>
  (import.meta.env.VITE_COORDINATOR_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const webApiKey = () => import.meta.env.VITE_WEB_API_KEY as string | undefined;

/**
 * Map a recording blob's MIME type to a file extension the transcription
 * backend recognises. Safari records MP4/AAC; Chrome/Firefox record WebM.
 */
function audioExtensionForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("mp4")) return "mp4";
  if (t.includes("aac") || t.includes("m4a")) return "m4a";
  if (t.includes("mpeg") || t.includes("mpga") || t.includes("mp3")) return "mp3";
  return "webm";
}

export async function createInferenceJob(
  file: Blob,
  messageType: MessageType,
  incidentTypeName?: string,
  interviewLanguage?: InterviewLanguage
): Promise<InferenceJob> {
  const base = coordinatorUrl();
  const key = webApiKey();
  if (!base || !key) {
    throw new Error("Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)");
  }

  const formData = new FormData();
  formData.append("file", file, `recording.${audioExtensionForType(file.type)}`);
  formData.append("message_type", messageType);
  if (incidentTypeName) {
    formData.append("incident_type_name", incidentTypeName);
  }
  if (interviewLanguage) {
    formData.append("interview_language", interviewLanguage);
  }

  const response = await fetch(`${base}/v1/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to create job (${response.status}): ${detail}`);
  }

  return response.json() as Promise<InferenceJob>;
}

export async function getInferenceJob(jobId: string): Promise<InferenceJob> {
  const base = coordinatorUrl();
  const key = webApiKey();
  if (!base || !key) {
    throw new Error("Coordinator is not configured");
  }

  const response = await fetch(`${base}/v1/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch job (${response.status})`);
  }

  return response.json() as Promise<InferenceJob>;
}

export async function requestJobExtraction(
  jobId: string,
  payload: ExtractJobRequest
): Promise<InferenceJob> {
  const base = coordinatorUrl();
  const key = webApiKey();
  if (!base || !key) {
    throw new Error("Coordinator is not configured");
  }

  const response = await fetch(`${base}/v1/jobs/${jobId}/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: payload.text,
      message_type: payload.messageType,
      incident_type_name: payload.incidentTypeName ?? null,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to request extraction (${response.status}): ${detail}`);
  }

  return response.json() as Promise<InferenceJob>;
}

export async function createAnalyzeInterviewJob(
  transcript: string,
  questions: InterviewQuestionInput[],
  interviewLanguage: InterviewLanguage = "en"
): Promise<InferenceJob> {
  const base = coordinatorUrl();
  const key = webApiKey();
  if (!base || !key) {
    throw new Error("Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)");
  }

  const response = await fetch(`${base}/v1/analyze-interview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
      questions,
      interview_language: interviewLanguage,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to create analysis job (${response.status}): ${detail}`);
  }

  return response.json() as Promise<InferenceJob>;
}

export interface CreateAnalyzePhotoJobContext {
  locationOfFire?: string;
  incidentTypeName?: string;
  stopMessageExcerpt?: string;
  fieldNotesExcerpt?: string;
}

export async function createAnalyzePhotoJob(
  file: Blob,
  fileName: string,
  context?: CreateAnalyzePhotoJobContext
): Promise<InferenceJob> {
  const base = coordinatorUrl();
  const key = webApiKey();
  if (!base || !key) {
    throw new Error("Coordinator is not configured (VITE_COORDINATOR_URL / VITE_WEB_API_KEY)");
  }

  const formData = new FormData();
  formData.append("file", file, fileName || "photo.jpg");
  if (context?.locationOfFire) {
    formData.append("location_of_fire", context.locationOfFire);
  }
  if (context?.incidentTypeName) {
    formData.append("incident_type_name", context.incidentTypeName);
  }
  if (context?.stopMessageExcerpt) {
    formData.append("stop_message_excerpt", context.stopMessageExcerpt);
  }
  if (context?.fieldNotesExcerpt) {
    formData.append("field_notes_excerpt", context.fieldNotesExcerpt);
  }

  const response = await fetch(`${base}/v1/analyze-photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to create photo analysis job (${response.status}): ${detail}`);
  }

  return response.json() as Promise<InferenceJob>;
}
