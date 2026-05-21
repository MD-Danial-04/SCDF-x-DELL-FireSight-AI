import { createContext, useContext, type ReactNode } from "react";
import type { IncidentType } from "../constants/incidentTemplates";

export interface ReportSession {
  incidentType: IncidentType | null;
  stopMessage: string;
  fieldNotes: string;
  premisesOwner?: string;
  premisesUen?: string;
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
