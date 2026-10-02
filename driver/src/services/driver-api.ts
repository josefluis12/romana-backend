import { parseDriverDispatches } from "./dispatch-parser";
import type { DispatchReconciliationInput, DriverDeliveryProof, DriverDispatch } from "../types/dispatch";

export class DriverApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function completeDriverDelivery(
  apiUrl: string,
  accessToken: string,
  orderId: string,
  proof: DriverDeliveryProof,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/driver/orders/${encodeURIComponent(orderId)}/deliver`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proof),
    });
  } catch {
    throw new DriverApiError("Unable to save the delivery. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null);
    const serverMessage = isRecord(value) && typeof value.error === "string" ? value.error : null;
    throw new DriverApiError(serverMessage ?? "The delivery could not be completed.", response.status);
  }
}

export async function reconcileDriverTrip(
  apiUrl: string,
  accessToken: string,
  dispatchId: string,
  input: DispatchReconciliationInput,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/driver/dispatches/${encodeURIComponent(dispatchId)}/reconcile`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new DriverApiError("Unable to submit the reconciliation. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null);
    const serverMessage = isRecord(value) && typeof value.error === "string" ? value.error : null;
    throw new DriverApiError(serverMessage ?? "The reconciliation could not be submitted.", response.status);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchDriverDispatches(
  apiUrl: string,
  accessToken: string,
): Promise<DriverDispatch[]> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/driver/dispatches`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new DriverApiError("Unable to reach Romana. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    const message = response.status === 401
      ? "Your session expired. Please sign in again."
      : "Assigned dispatches are unavailable right now.";
    throw new DriverApiError(message, response.status);
  }

  const body: unknown = await response.json();
  return parseDriverDispatches(body);
}
