import { getSupabaseClient } from "./supabaseClient";
import type {
  FloorplanAmendment,
  FloorplanGeneratedElement,
  FloorplanViewBox,
} from "./floorplanEditor";

const TABLE = "floorplan_drafts";

export const FLOORPLAN_DRAFT_PAYLOAD_VERSION = 1 as const;

export interface FloorplanDraftGroup {
  id: string;
  name: string;
  memberIds: string[];
}

/** Full serializable snapshot of the floorplan editor canvas. */
export interface FloorplanDraftPayload {
  version: typeof FLOORPLAN_DRAFT_PAYLOAD_VERSION;
  svgText: string;
  baseViewBox: FloorplanViewBox;
  amendments: Record<string, FloorplanAmendment>;
  generatedElements: FloorplanGeneratedElement[];
  groups: FloorplanDraftGroup[];
  fileName: string;
}

/** Lightweight row used to render the drafts list. */
export interface FloorplanDraftSummary {
  id: string;
  name: string;
  updatedAt: string;
  thumbnail: string | null;
}

/** Full draft row including the editor payload. */
export interface FloorplanDraft extends FloorplanDraftSummary {
  incidentNo: string;
  payload: FloorplanDraftPayload;
  createdAt: string;
}

interface FloorplanDraftRow {
  id: string;
  incident_no: string;
  name: string;
  payload: FloorplanDraftPayload;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

function toSummary(row: Pick<FloorplanDraftRow, "id" | "name" | "updated_at" | "thumbnail">): FloorplanDraftSummary {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    thumbnail: row.thumbnail ?? null,
  };
}

function toDraft(row: FloorplanDraftRow): FloorplanDraft {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    thumbnail: row.thumbnail ?? null,
    incidentNo: row.incident_no,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

/** List drafts for an incident, most recently updated first. */
export async function listDrafts(incidentNo: string): Promise<FloorplanDraftSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, updated_at, thumbnail")
    .eq("incident_no", incidentNo)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

/** Fetch a single draft including its full payload. */
export async function getDraft(id: string): Promise<FloorplanDraft> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, incident_no, name, payload, thumbnail, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return toDraft(data as FloorplanDraftRow);
}

/** Create a new named draft for an incident. */
export async function createDraft(
  incidentNo: string,
  name: string,
  payload: FloorplanDraftPayload,
  thumbnail?: string | null,
): Promise<FloorplanDraftSummary> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ incident_no: incidentNo, name, payload, thumbnail: thumbnail ?? null })
    .select("id, name, updated_at, thumbnail")
    .single();

  if (error) throw new Error(error.message);
  return toSummary(data as FloorplanDraftRow);
}

/** Overwrite an existing draft's payload (and optionally name/thumbnail). */
export async function updateDraft(
  id: string,
  payload: FloorplanDraftPayload,
  options?: { name?: string; thumbnail?: string | null },
): Promise<FloorplanDraftSummary> {
  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = { payload };
  if (options?.name !== undefined) patch.name = options.name;
  if (options?.thumbnail !== undefined) patch.thumbnail = options.thumbnail;

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("id, name, updated_at, thumbnail")
    .single();

  if (error) throw new Error(error.message);
  return toSummary(data as FloorplanDraftRow);
}

/** Delete a draft by id. */
export async function deleteDraft(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
