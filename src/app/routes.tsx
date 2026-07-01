import { createBrowserRouter, useLocation } from "react-router";
import { Layout } from "./components/Layout";
import { StopMessageRedirect } from "./components/StopMessageRedirect";
import { Dashboard } from "./pages/Dashboard";
import { StopMessage } from "./pages/StopMessage";
import { ReportGeneration } from "./pages/ReportGeneration";
import { SlidesGeneration } from "./pages/SlidesGeneration";
import { Records } from "./pages/Records";
import { NotFound } from "./pages/NotFound";
import { AnnexGBurnChartPreview } from "./pages/AnnexGBurnChartPreview";
import {
  ReportSessionProvider,
  type ReportSession,
} from "./context/ReportSessionContext";
import type { IncidentType } from "./constants/incidentTemplates";

function getRouteSessionValue(state: unknown): ReportSession {
  const session = (state ?? {}) as Partial<ReportSession> & {
    incidentType?: IncidentType | null;
  };

  return {
    incidentType: session.incidentType ?? null,
    stopMessage: session.stopMessage ?? "",
    fieldNotes: session.fieldNotes ?? "",
    premisesOwner: session.premisesOwner,
    premisesUen: session.premisesUen,
    resumeDraftIncidentNo: session.resumeDraftIncidentNo,
    initialSectionId: session.initialSectionId,
  };
}

function ReportRoute() {
  const location = useLocation();
  const session = getRouteSessionValue(location.state);
  const remountKey =
    session.resumeDraftIncidentNo ??
    session.transcriptionJobId ??
    (session.stopMessage.slice(0, 64) || "new-report");
  return (
    <ReportSessionProvider value={session}>
      <ReportGeneration key={remountKey} />
    </ReportSessionProvider>
  );
}

function SlidesRoute() {
  const location = useLocation();
  return (
    <ReportSessionProvider value={getRouteSessionValue(location.state)}>
      <SlidesGeneration />
    </ReportSessionProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "incident", Component: StopMessage },
      { path: "records", Component: Records },
      { path: "stop-message", Component: StopMessageRedirect },
      { path: "report", Component: ReportRoute },
      { path: "slides", Component: SlidesRoute },
      { path: "preview/annex-g", Component: AnnexGBurnChartPreview },
      { path: "*", Component: NotFound },
    ],
  },
]);
