import { FileText, FileImage } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/PageHeader";

const pastDocuments = [
  { id: "RPT-2026-001", location: "Blk 123 Ang Mo Kio Ave 3", date: "2026-05-19 14:30", type: "Report" as const },
  { id: "SLD-2026-002", location: "NUS Science Block", date: "2026-05-18 09:15", type: "Slides" as const },
  { id: "RPT-2026-003", location: "HDB Hub", date: "2026-05-17 22:45", type: "Report" as const },
  { id: "SLD-2026-004", location: "Jurong West St 42", date: "2026-05-16 18:20", type: "Slides" as const },
  { id: "RPT-2026-005", location: "Tampines Mall", date: "2026-05-15 11:05", type: "Report" as const },
];

export function Records() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Records"
        description="Browse past fire investigation reports and activation slide decks."
      />

      <Card className="rounded-xl shadow-sm border-border/80">
        <CardHeader>
          <CardTitle>Past documentation</CardTitle>
          <CardDescription>Reports and slides generated in this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pastDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-default"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div
                    className={
                      doc.type === "Report"
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-fire-muted"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-slides-muted"
                    }
                  >
                    {doc.type === "Report" ? (
                      <FileText className="w-5 h-5 text-primary" />
                    ) : (
                      <FileImage className="w-5 h-5 text-brand-slides" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{doc.id}</p>
                    <p className="text-sm text-muted-foreground truncate">{doc.location}</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{doc.date}</p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    doc.type === "Report"
                      ? "bg-brand-fire-muted text-primary border-red-100 shrink-0"
                      : "bg-brand-slides-muted text-brand-slides border-blue-100 shrink-0"
                  }
                >
                  {doc.type}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
