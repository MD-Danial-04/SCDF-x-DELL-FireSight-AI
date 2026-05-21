import { Navigate, useSearchParams } from "react-router";

/** Legacy `/stop-message?mode=…` URLs → canonical routes */
export function StopMessageRedirect() {
  const [searchParams] = useSearchParams();
  const target = searchParams.get("mode") === "late" ? "/late-activation" : "/incident";
  return <Navigate to={target} replace />;
}
