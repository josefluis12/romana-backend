import type { ChannelSaleActor } from "./channel-sales.js";
import type { DispatchReconciliation, DispatchReconciliationInput } from "../types/channel-sales.js";

export async function reconcileAssignedDriverDispatch(
  url: string,
  secretKey: string,
  dispatchId: string,
  input: DispatchReconciliationInput,
  actor: ChannelSaleActor,
): Promise<boolean> {
  const response = await fetch(`${url}/rest/v1/rpc/reconcile_driver_dispatch`, {
    method: "POST",
    headers: { apikey: secretKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      target_dispatch_id: dispatchId,
      driver_user_id: actor.userId,
      driver_email: actor.email,
      order_results: input.orders,
      inventory_exceptions: input.exceptions,
      reconciliation_notes: input.notes,
    }),
  });
  if (!response.ok) throw new Error("Driver dispatch reconciliation request failed.");
  const changed: unknown = await response.json();
  if (typeof changed !== "boolean") throw new Error("Driver dispatch reconciliation returned invalid data.");
  return changed;
}

export function readDispatchReconciliation(value: Record<string, unknown>): DispatchReconciliation | null {
  const row = readOptionalFirst(value.baguio_dispatch_reconciliations);
  if (!row) return null;
  return {
    submittedAt: readString(row.submitted_at),
    totalCollected: readNumber(row.total_collected),
    notes: readString(row.notes),
    orders: readArray(row.baguio_dispatch_reconciliation_orders).map((order) => ({
      orderId: readString(order.order_id),
      outcome: readOutcome(order.outcome),
      collectedAmount: readNumber(order.collected_amount),
      failureReason: readString(order.failure_reason),
    })),
    inventory: readArray(row.baguio_dispatch_reconciliation_inventory).map((item) => ({
      productVariantId: readString(item.product_variant_id),
      productTitle: readString(item.product_title),
      variantLabel: readString(item.variant_label),
      allocatedQuantity: readNumber(item.allocated_quantity),
      deliveredQuantity: readNumber(item.delivered_quantity),
      returnedQuantity: readNumber(item.returned_quantity),
      damagedQuantity: readNumber(item.damaged_quantity),
      missingQuantity: readNumber(item.missing_quantity),
      remainingQuantity: readNumber(item.remaining_quantity),
      notes: readString(item.notes),
    })),
  };
}

function readOutcome(value: unknown): "delivered" | "failed" {
  if (value !== "delivered" && value !== "failed") throw new Error("Invalid reconciliation outcome.");
  return value;
}
function readOptionalFirst(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) throw new Error("Invalid reconciliation data.");
  const first: unknown = value[0];
  if (first === undefined) return null;
  if (!isRecord(first)) throw new Error("Invalid reconciliation data.");
  return first;
}
function readArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error("Invalid reconciliation data.");
  return value;
}
function readString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid reconciliation data.");
  return value;
}
function readNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid reconciliation data.");
  return parsed;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
