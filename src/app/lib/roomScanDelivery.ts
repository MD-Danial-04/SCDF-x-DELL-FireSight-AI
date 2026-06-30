/** Dispatched after an iPhone room scan is delivered into the scan library. */
export const ROOM_SCAN_DELIVERY_EVENT = "firesight-room-scan-delivery";

export interface RoomScanDeliveryRequest {
  scanId: string;
}

export interface RoomScanDeliveryEventDetail extends RoomScanDeliveryRequest {
  openFloorplan: true;
}

let pendingDelivery: RoomScanDeliveryRequest | null = null;

export function requestRoomScanFloorplanDelivery(scanId: string): void {
  pendingDelivery = { scanId };
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RoomScanDeliveryEventDetail>(ROOM_SCAN_DELIVERY_EVENT, {
      detail: { scanId, openFloorplan: true },
    })
  );
}

export function getPendingRoomScanDelivery(): RoomScanDeliveryRequest | null {
  return pendingDelivery;
}

export function clearPendingRoomScanDelivery(): void {
  pendingDelivery = null;
}
