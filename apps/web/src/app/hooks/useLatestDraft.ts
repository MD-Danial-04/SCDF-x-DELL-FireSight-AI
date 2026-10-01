import { useCallback, useEffect, useState } from "react";
import {
  listIncidentDrafts,
  type IncidentDraftSummary,
} from "../lib/incidentDrafts";

interface UseLatestDraftResult {
  draft: IncidentDraftSummary | null;
  drafts: IncidentDraftSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Loads incident drafts for the dashboard: the most recent "active case" plus the full list. */
export function useLatestDraft(): UseLatestDraftResult {
  const [drafts, setDrafts] = useState<IncidentDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listIncidentDrafts();
      setDrafts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved drafts.");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { draft: drafts[0] ?? null, drafts, loading, error, refresh };
}
