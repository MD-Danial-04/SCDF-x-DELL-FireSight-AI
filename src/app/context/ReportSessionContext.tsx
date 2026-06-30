import { createContext, useContext, type ReactNode } from "react";
import type { IncidentType } from "../constants/incidentTemplates";

export interface ReportSession {
  incidentType: IncidentType | null;
  stopMessage: string;
  fieldNotes: string;
  /** Active demo scenario id when report was started from a demo selection. */
  demoScenarioId?: string;
  premisesOwner?: string;
  premisesUen?: string;
  transcriptionJobId?: string;
  /** When set, ReportGeneration resumes this incident's saved draft instead of running extraction. */
  resumeDraftIncidentNo?: string;
  /** When set, ReportGeneration opens this section/nav id on mount (e.g. deep link from the dashboard). */
  initialSectionId?: string;
}

const ReportSessionContext = createContext<ReportSession | null>(null);

export function ReportSessionProvider({
  value,
  children,
}: {
  value: ReportSession;
  children: ReactNode;
}) {
  return (
    <ReportSessionContext.Provider value={value}>
      {children}
    </ReportSessionContext.Provider>
  );
}

export function useOptionalReportSession(): ReportSession | null {
  return useContext(ReportSessionContext);
}

export function useReportSession(): ReportSession {
  const ctx = useOptionalReportSession();
  if (!ctx) {
    throw new Error("useReportSession must be used within ReportSessionProvider");
  }
  return ctx;
}
