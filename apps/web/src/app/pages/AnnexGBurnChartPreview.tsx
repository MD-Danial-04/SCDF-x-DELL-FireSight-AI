import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { AnnexGBurnChartEditor } from "../components/AnnexGBurnChartEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { getDefaultPagePreviewUrl } from "../lib/annexImageAssets";

const ANNEX_G_PAGE_INDEX = 8;

export function AnnexGBurnChartPreview() {
  const [incidentNo, setIncidentNo] = useState("FIR/2026/0622/0001");
  const [locationOfFire, setLocationOfFire] = useState("Blk 123 Ang Mo Kio Ave 3");
  const [overrideBlob, setOverrideBlob] = useState<Blob | null>(null);
  const [overrideUrl, setOverrideUrl] = useState<string | null>(null);

  useEffect(() => {
    if (overrideUrl) URL.revokeObjectURL(overrideUrl);
    if (!overrideBlob) {
      setOverrideUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(overrideBlob);
    setOverrideUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [overrideBlob]);

  const templateUrl = useMemo(
    () => getDefaultPagePreviewUrl(ANNEX_G_PAGE_INDEX),
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Annex G Preview"
        description="Standalone web preview for the burn-chart editor. Paint on the template and verify the exported Annex G image below."
      />

      <AnnexGBurnChartEditor
        enabled
        incidentNo={incidentNo}
        locationOfFire={locationOfFire}
        onOverrideChange={(_pageIndex, blob) => setOverrideBlob(blob)}
      />

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Exported Annex G image</CardTitle>
          <CardDescription>
            This is the actual page image generated from the editor and passed into the annex override pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-border bg-slate-100">
            <img
              src={overrideUrl ?? templateUrl ?? undefined}
              alt="Annex G preview"
              className="w-full h-auto object-contain"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
