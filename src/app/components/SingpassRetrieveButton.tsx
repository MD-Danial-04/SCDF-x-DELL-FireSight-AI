import { useState } from "react";
import { Button } from "./ui/button";
import { SingpassRetrieveDialog } from "./SingpassRetrieveDialog";
import type { MyInfoPerson, MyInfoScope } from "../types/myinfo";

const SINGPASS_RED = "#F4333D";

interface SingpassRetrieveButtonProps {
  purpose: string;
  scopes: MyInfoScope[];
  onRetrieved: (person: MyInfoPerson) => void;
  label?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  disabled?: boolean;
}

export function SingpassRetrieveButton({
  purpose,
  scopes,
  onRetrieved,
  label = "Retrieve with Singpass",
  size = "sm",
  className,
  disabled,
}: SingpassRetrieveButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        className={className}
        style={{ backgroundColor: SINGPASS_RED, color: "white" }}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <SingpassRetrieveDialog
        open={open}
        onOpenChange={setOpen}
        purpose={purpose}
        scopes={scopes}
        onRetrieved={onRetrieved}
      />
    </>
  );
}
