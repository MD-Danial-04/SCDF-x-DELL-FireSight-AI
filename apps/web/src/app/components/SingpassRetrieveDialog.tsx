import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { getSingpassProvider } from "../lib/singpass/SingpassProvider";
import { useActivePersonaId } from "../lib/singpass/singpassSettings";
import { getPersonaById } from "../constants/singpassPersonas";
import {
  MYINFO_ATTRIBUTE_LABELS,
  type MyInfoPerson,
  type MyInfoScope,
} from "../types/myinfo";

const SINGPASS_RED = "#F4333D";
/** How long the QR sits before the simulated scan auto-fires. */
const AUTO_SCAN_DELAY_MS = 6000;

interface SingpassRetrieveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the retrieved data fills, shown beneath the QR. */
  purpose: string;
  /** MyInfo attributes requested. */
  scopes: MyInfoScope[];
  onRetrieved: (person: MyInfoPerson) => void;
}

type Step = "qr" | "retrieving";

export function SingpassRetrieveDialog({
  open,
  onOpenChange,
  purpose,
  scopes,
  onRetrieved,
}: SingpassRetrieveDialogProps) {
  const provider = useMemo(() => getSingpassProvider(), []);
  const activePersonaId = useActivePersonaId();
  const [step, setStep] = useState<Step>("qr");
  const sessionId = useMemo(
    () => Math.random().toString(36).slice(2, 12).toUpperCase(),
    // Regenerate per open so each retrieval shows a fresh QR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );
  const scannedRef = useRef(false);

  const scopeLabels = scopes
    .map((scope) => MYINFO_ATTRIBUTE_LABELS[scope] ?? scope)
    .filter((label, index, all) => all.indexOf(label) === index);

  const qrValue = `https://stg-id.singpass.gov.sg/qrlogin?sessionId=${sessionId}&client_id=FIRESIGHT-DEMO`;
  const activePersona = getPersonaById(activePersonaId);

  const handleScan = async () => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setStep("retrieving");
    try {
      const person = await provider.retrievePerson(activePersonaId, scopes);
      onRetrieved(person);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not retrieve Myinfo data"
      );
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (!open) {
      scannedRef.current = false;
      setStep("qr");
      return;
    }
    const timer = setTimeout(() => void handleScan(), AUTO_SCAN_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div
          className="flex items-center justify-between px-6 py-4 text-white"
          style={{ backgroundColor: SINGPASS_RED }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">singpass</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Simulated
            </span>
          </div>
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="px-6 pb-6 pt-2">
          <DialogHeader>
            <DialogTitle>
              {step === "qr"
                ? "Scan to retrieve with Singpass"
                : "Retrieving Myinfo data"}
            </DialogTitle>
            <DialogDescription>
              {step === "qr"
                ? "Ask the interviewee to scan this QR code with their Singpass app to share their Myinfo data. This is a simulation — no real Singpass login or personal data is used."
                : purpose}
            </DialogDescription>
          </DialogHeader>

          {step === "qr" ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <QRCodeSVG
                    value={qrValue}
                    size={180}
                    level="M"
                    fgColor="#1f2937"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  Waiting for the interviewee to scan…
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Data to be shared
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {scopeLabels.map((label) => (
                    <li
                      key={label}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="button"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: SINGPASS_RED }}
                onClick={() => void handleScan()}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Simulate scan
              </Button>
              {activePersona ? (
                <p className="text-center text-[11px] text-slate-400">
                  Demo identity: {activePersona.label} · change in Developer
                  settings
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
              <p className="text-sm text-slate-600">
                Retrieving Myinfo data from Singpass…
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
