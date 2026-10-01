import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { PageHeader } from "../components/PageHeader";
import {
  deleteIncidentDraft,
  listIncidentDrafts,
  type IncidentDraftSummary,
} from "../lib/incidentDrafts";
import { deletePhotos } from "../lib/photoDraftStore";

export function Records() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<IncidentDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteIncidentNo, setPendingDeleteIncidentNo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listIncidentDrafts();
      setDrafts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved drafts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleResume = (incidentNo: string) => {
    navigate("/report", { state: { resumeDraftIncidentNo: incidentNo, incidentType: null } });
  };

  const handleConfirmDelete = async () => {
    const incidentNo = pendingDeleteIncidentNo;
    setPendingDeleteIncidentNo(null);
    if (!incidentNo) return;
    setDeleting(true);
    try {
      await deleteIncidentDraft(incidentNo);
      await deletePhotos(incidentNo);
      toast.success("Draft deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete draft");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Records"
        description="Resume saved incident drafts. Fields and annex edits sync across devices; photos are restored only on the device where they were saved."
        actions={
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <Card className="rounded-xl shadow-sm border-border/80">
        <CardHeader>
          <CardTitle>Saved drafts</CardTitle>
          <CardDescription>Incident drafts saved from the report editor</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : loading && drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading saved drafts…</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved drafts yet. Use <span className="font-medium">Save draft</span> in the report
              editor to store one here.
            </p>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => (
                <div
                  key={draft.incidentNo}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-fire-muted">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{draft.incidentNo}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {draft.locationOfFire || "Location not set"}
                      </p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        Updated {new Date(draft.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      className="flex-1 sm:flex-none"
                      onClick={() => handleResume(draft.incidentNo)}
                    >
                      Resume
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-red-600 hover:text-red-700"
                      onClick={() => setPendingDeleteIncidentNo(draft.incidentNo)}
                      title={`Delete draft ${draft.incidentNo}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDeleteIncidentNo !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIncidentNo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the saved draft from the cloud and any photos stored on this
              device. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
