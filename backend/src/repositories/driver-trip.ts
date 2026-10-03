import type { ChannelSaleActor } from "./channel-sales.js";

export async function startAssignedDriverTrip(
  url: string,
  secretKey: string,
  dispatchId: string,
  actor: ChannelSaleActor,
): Promise<boolean> {
  const response = await fetch(`${url}/rest/v1/rpc/start_driver_trip`, {
    method: "POST",
    headers: { apikey: secretKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      target_dispatch_id: dispatchId,
      authenticated_driver_user_id: actor.userId,
      driver_email: actor.email,
    }),
  });
  if (!response.ok) throw new Error("Driver trip start request failed.");
  const changed: unknown = await response.json();
  if (typeof changed !== "boolean") throw new Error("Driver trip start returned invalid data.");
  return changed;
}
