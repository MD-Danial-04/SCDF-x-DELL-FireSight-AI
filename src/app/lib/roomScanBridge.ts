import { toast } from "sonner";
import { addRoomScanFromJson } from "./roomScanLibrary";

/**
 * Bridge that lets the FireSight iOS host (a WKWebView) deliver a captured room
 * scan straight into the embedded web app. The native side calls
 * `window.fireSightRoomScan.deliverBase64(...)` after a scan; the scan is
 * appended to the device-local scan library, where the floor plan editor can
 * pick it up. This is fire-and-forget: it works regardless of which screen is
 * open or whether an incident is active.
 */
export interface RoomScanBridge {
  deliver: (json: string) => boolean;
  deliverBase64: (base64: string) => boolean;
}

declare global {
  interface Window {
    fireSightRoomScan?: RoomScanBridge;
  }
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function deliver(json: string): boolean {
  try {
    const item = addRoomScanFromJson(json);
    toast.success(`Room scan "${item.name}" added from iPhone`);
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import room scan";
    toast.error(message);
    return false;
  }
}

function deliverBase64(base64: string): boolean {
  try {
    return deliver(decodeBase64Utf8(base64));
  } catch {
    toast.error("Failed to decode room scan from iPhone");
    return false;
  }
}

export function registerRoomScanBridge(): void {
  if (typeof window === "undefined") return;
  window.fireSightRoomScan = { deliver, deliverBase64 };
}
