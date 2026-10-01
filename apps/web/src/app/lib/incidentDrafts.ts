import { getSupabaseClient } from "./supabaseClient";
import type { FireReportData } from "../types/fireReport";
import type { FloorplanDraftPayload } from "./floorplanDrafts";
import type { AnnexEMarker } from "./annexEMarkers";
import type { AnnexGEditorState } from "../components/AnnexGBurnChartEditor";

const TABLE = "incident_drafts";

export const INCIDENT_DRAFT_PAYLOAD_VERSION = 1 as const;

/** Cross-device JSON snapshot of a report draft (no binary photos). */
export interface IncidentDraftPayload {
  version: typeof INCIDENT_DRAFT_PAYLOAD_VERSION;
  reportFields: FireReportData;
  floorplanSvg: string | null;
  floorplanDraftState: FloorplanDraftPayload | null;
  annexEMarkers: AnnexEMarker[];
  annexGState: AnnexGEditorState | null;
}

/** Lightweight row used to render the Records list. */
export interface IncidentDraftSummary {
  incidentNo: string;
  locationOfFire: string | null;
  updatedAt: string;
}

export interface IncidentDraft extends IncidentDraftSummary {
  payload: IncidentDraftPayload;
  createdAt: string;
}

interface IncidentDraftRow {
  incident_no: string;
  location_of_fire: string | null;
  payload: IncidentDraftPayload;
  created_at: string;
  updated_at: string;
}

function toSummary(
  row: Pick<IncidentDraftRow, "incident_no" | "location_of_fire" | "updated_at">,
): IncidentDraftSummary {
  return {
    incidentNo: row.incident_no,
    locationOfFire: row.location_of_fire ?? null,
    updatedAt: row.updated_at,
  };
}

/** Create or overwrite the draft for an incident (one row per incident). */
export async function upsertIncidentDraft(
  incidentNo: string,
  locationOfFire: string | null,
  payload: IncidentDraftPayload,
): Promise<IncidentDraftSummary> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { incident_no: incidentNo, location_of_fire: locationOfFire, payload },
      { onConflict: "incident_no" },
    )
    .select("incident_no, location_of_fire, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return toSummary(data as IncidentDraftRow);
}

/** Fetch a single incident draft including its payload. */
export async function getIncidentDraft(incidentNo: string): Promise<IncidentDraft | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("incident_no, location_of_fire, payload, created_at, updated_at")
    .eq("incident_no", incidentNo)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as IncidentDraftRow;
  return {
    incidentNo: row.incident_no,
    locationOfFire: row.location_of_fire ?? null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    payload: row.payload,
  };
}

/** List all incident drafts, most recently updated first. */
export async function listIncidentDrafts(): Promise<IncidentDraftSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("incident_no, location_of_fire, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

/** Delete the draft for an incident. */
export async function deleteIncidentDraft(incidentNo: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("incident_no", incidentNo);
  if (error) throw new Error(error.message);
}
