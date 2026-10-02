import type { BaguioDispatch } from "../../../../types/channel-sale";

export interface DispatchLocationPing {
  orderId: string;
  orderReferenceNumber: string;
  clientName: string;
  signedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function getDispatchLocations(dispatch: BaguioDispatch): DispatchLocationPing[] {
  return dispatch.orders.flatMap((order) => {
    const proof = order.deliveryReceipt.proof;
    if (!proof) return [];
    return [{
      orderId: order.id,
      orderReferenceNumber: order.referenceNumber,
      clientName: order.clientName,
      signedAt: proof.signedAt,
      latitude: proof.latitude,
      longitude: proof.longitude,
      accuracy: proof.accuracy,
    }];
  }).sort((left, right) => Date.parse(left.signedAt) - Date.parse(right.signedAt));
}

export function getLatestDispatchLocation(dispatch: BaguioDispatch): DispatchLocationPing | null {
  return getDispatchLocations(dispatch).at(-1) ?? null;
}
