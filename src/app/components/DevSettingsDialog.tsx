import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { SINGPASS_PERSONAS } from "../constants/singpassPersonas";
import {
  setActivePersonaId,
  useActivePersonaId,
} from "../lib/singpass/singpassSettings";

interface DevSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevSettingsDialog({
  open,
  onOpenChange,
}: DevSettingsDialogProps) {
  const activePersonaId = useActivePersonaId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Developer settings</DialogTitle>
          <DialogDescription>
            Demo-only controls. These settings affect the simulated Singpass
            flow and are not used in production.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Singpass demo identity
            </p>
            <p className="text-xs text-slate-500">
              The identity returned when an interviewee &ldquo;scans&rdquo; the
              simulated Singpass QR code.
            </p>
          </div>

          <RadioGroup
            value={activePersonaId}
            onValueChange={setActivePersonaId}
            className="gap-2"
          >
            {SINGPASS_PERSONAS.map((persona) => (
              <Label
                key={persona.id}
                htmlFor={`persona-${persona.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50 has-[:checked]:border-red-300 has-[:checked]:bg-red-50"
              >
                <RadioGroupItem
                  id={`persona-${persona.id}`}
                  value={persona.id}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    {persona.label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {persona.caption} · {persona.person.uinfin}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}
