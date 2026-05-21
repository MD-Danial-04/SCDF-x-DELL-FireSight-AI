import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { StopMessageRedirect } from "./components/StopMessageRedirect";
import { Dashboard } from "./pages/Dashboard";
import { StopMessage } from "./pages/StopMessage";
import { ReportGeneration } from "./pages/ReportGeneration";
import { SlidesGeneration } from "./pages/SlidesGeneration";
import { Records } from "./pages/Records";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "incident", Component: StopMessage },
      { path: "late-activation", Component: StopMessage },
      { path: "records", Component: Records },
      { path: "stop-message", Component: StopMessageRedirect },
      { path: "report", Component: ReportGeneration },
      { path: "slides", Component: SlidesGeneration },
      { path: "*", Component: NotFound },
    ],
  },
]);
