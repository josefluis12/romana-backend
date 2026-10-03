import type { ChannelSaleActor } from "./channel-sales.js";
import type { DispatchReconciliation, DispatchReconciliationInput } from "../types/channel-sales.js";

const reconciliationFields = "id,dispatch_id,submitted_at,total_collected,notes";
const orderFields = "order_id,outcome,collected_amount,failure_reason";
const inventoryFields = "product_variant_id,product_title,variant_label,allocated_quantity,delivered_quantity,returned_quantity,damaged_quantity,missing_quantity,remaining_quantity,notes";

export async function reconcileAssignedDriverDispatch(
  url: string,
  secretKey: string,
  dispatchId: string,
  input: DispatchReconciliationInput,
  actor: ChannelSaleActor,
): Promise<boolean> {
  const collectedAmounts = await loadCollectedAmounts(url, secretKey, input);
  const orderResults = input.orders.map((order) => ({
    ...order,
    collectedAmount: order.outcome === "failed" ? 0 : collectedAmounts.get(order.orderId),
  }));
  const response = await fetch(`${url}/rest/v1/rpc/reconcile_driver_dispatch`, {
    method: "POST",
    headers: { apikey: secretKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      target_dispatch_id: dispatchId,
      driver_user_id: actor.userId,
      driver_email: actor.email,
      order_results: orderResults,
      inventory_exceptions: input.exceptions,
      reconciliation_notes: input.notes,
    }),
  });
  if (!response.ok) throw new Error("Driver dispatch reconciliation request failed.");
  const changed: unknown = await response.json();
  if (typeof changed !== "boolean") throw new Error("Driver dispatch reconciliation returned invalid data.");
  return changed;
}

async function loadCollectedAmounts(
  url: string,
  secretKey: string,
  input: DispatchReconciliationInput,
): Promise<Map<string, number>> {
  const orderIds = input.orders.filter((order) => order.outcome === "delivered").map((order) => order.orderId);
  if (orderIds.length === 0) return new Map();
  const filter = encodeURIComponent(`in.(${orderIds.join(",")})`);
  const response = await fetch(`${url}/rest/v1/delivery_receipts?select=order_id,collected_amount&order_id=${filter}`, {
    headers: { apikey: secretKey, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Delivery payment storage request failed.");
  const payments = new Map(readRecords(await response.json()).map((row) => [
    readString(row.order_id),
    readCollectedAmount(row.collected_amount),
  ]));
  if (orderIds.some((orderId) => !payments.has(orderId))) {
    throw new Error("A delivered order is missing its collected amount.");
  }
  return payments;
}

export async function loadDispatchReconciliations(
  url: string,
  secretKey: string,
  dispatchIds: string[],
): Promise<Map<string, DispatchReconciliation>> {
  if (dispatchIds.length === 0) return new Map();
  const headers = { apikey: secretKey, "Content-Type": "application/json" };
  const filter = encodeURIComponent(`in.(${dispatchIds.join(",")})`);
  const orderSelect = encodeURIComponent(`${reconciliationFields},baguio_dispatch_reconciliation_orders(${orderFields})`);
  const inventorySelect = encodeURIComponent(`${reconciliationFields},baguio_dispatch_reconciliation_inventory(${inventoryFields})`);
  const [orderResponse, inventoryResponse] = await Promise.all([
    fetch(`${url}/rest/v1/baguio_dispatch_reconciliations?select=${orderSelect}&dispatch_id=${filter}&limit=${dispatchIds.length}`, { headers }),
    fetch(`${url}/rest/v1/baguio_dispatch_reconciliations?select=${inventorySelect}&dispatch_id=${filter}&limit=${dispatchIds.length}`, { headers }),
  ]);
  if (!orderResponse.ok || !inventoryResponse.ok) {
    throw new Error("Dispatch reconciliation storage request failed.");
  }
  const orderRows = readRecords(await orderResponse.json());
  const inventoryRows = readRecords(await inventoryResponse.json());
  const inventoryById = new Map(inventoryRows.map((row) => [readString(row.id), row]));
  return new Map(orderRows.map((row) => {
    const id = readString(row.id);
    const inventoryRow = inventoryById.get(id);
    if (!inventoryRow) throw new Error("Dispatch reconciliation storage returned incomplete data.");
    return [readString(row.dispatch_id), readDispatchReconciliation(row, inventoryRow)];
  }));
}

function readDispatchReconciliation(
  orderRow: Record<string, unknown>,
  inventoryRow: Record<string, unknown>,
): DispatchReconciliation {
  return {
    submittedAt: readString(orderRow.submitted_at),
    totalCollected: readNumber(orderRow.total_collected),
    notes: readString(orderRow.notes),
    orders: readRecords(orderRow.baguio_dispatch_reconciliation_orders).map((order) => ({
      orderId: readString(order.order_id),
      outcome: readOutcome(order.outcome),
      collectedAmount: readNumber(order.collected_amount),
      failureReason: readString(order.failure_reason),
    })),
    inventory: readRecords(inventoryRow.baguio_dispatch_reconciliation_inventory).map((item) => ({
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
function readRecords(value: unknown): Record<string, unknown>[] {
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
function readCollectedAmount(value: unknown): number {
  const amount = readNumber(value);
  if (amount <= 0 || amount > 1_000_000_000) throw new Error("Invalid collected amount data.");
  return amount;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
