import type { ChannelSaleActor } from "./channel-sales.js";
import type { DriverDeliveryProof } from "../types/channel-sales.js";

export async function completeDriverDelivery(
  url: string,
  secretKey: string,
  orderId: string,
  proof: DriverDeliveryProof,
  actor: ChannelSaleActor,
): Promise<boolean> {
  const response = await fetch(`${url}/rest/v1/rpc/complete_driver_delivery`, {
    method: "POST",
    headers: { apikey: secretKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      target_order_id: orderId,
      driver_user_id: actor.userId,
      driver_email: actor.email,
      signature_strokes: proof.signature,
      p_signed_latitude: proof.latitude,
      p_signed_longitude: proof.longitude,
      p_location_accuracy: proof.accuracy,
      p_payment_mode: proof.paymentMode,
    }),
  });
  if (!response.ok) throw new Error("Driver delivery request failed.");
  const changed: unknown = await response.json();
  if (typeof changed !== "boolean") {
    throw new Error("Driver delivery storage returned invalid data.");
  }
  return changed;
}
