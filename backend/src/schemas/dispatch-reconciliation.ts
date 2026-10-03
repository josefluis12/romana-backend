import type { DispatchReconciliationInput, ReconciliationOrderOutcome } from "../types/channel-sales.js";
import { isUuid } from "./channel-sales.js";

const outcomes = new Set<ReconciliationOrderOutcome>(["delivered", "failed"]);

export function validateDispatchReconciliation(value: unknown): { input?: DispatchReconciliationInput; error?: string } {
  if (!isRecord(value) || !Array.isArray(value.orders) || !Array.isArray(value.exceptions)) {
    return { error: "A reconciliation with orders and inventory exceptions is required." };
  }
  if (value.orders.length < 1 || value.orders.length > 200 || value.exceptions.length > 200) {
    return { error: "The reconciliation contains an invalid number of entries." };
  }
  const orders = value.orders.map(readOrder);
  const exceptions = value.exceptions.map(readException);
  if (orders.some((entry) => !entry) || exceptions.some((entry) => !entry)) {
    return { error: "The reconciliation contains invalid order or inventory values." };
  }
  const orderIds = orders.map((entry) => entry!.orderId);
  const variantIds = exceptions.map((entry) => entry!.productVariantId);
  if (new Set(orderIds).size !== orderIds.length || new Set(variantIds).size !== variantIds.length) {
    return { error: "Orders and inventory variants may only be submitted once." };
  }
  const notes = readText(value.notes, 1000);
  if (notes === null) return { error: "Reconciliation notes must be 1,000 characters or fewer." };
  return { input: { orders: orders as DispatchReconciliationInput["orders"], exceptions: exceptions as DispatchReconciliationInput["exceptions"], notes } };
}

function readOrder(value: unknown): DispatchReconciliationInput["orders"][number] | null {
  if (!isRecord(value) || typeof value.orderId !== "string" || !isUuid(value.orderId)
    || typeof value.outcome !== "string" || !outcomes.has(value.outcome as ReconciliationOrderOutcome)) return null;
  const failureReason = readText(value.failureReason, 500);
  if (failureReason === null) return null;
  if (value.outcome === "failed" && !failureReason) return null;
  return { orderId: value.orderId, outcome: value.outcome as ReconciliationOrderOutcome, failureReason };
}

function readException(value: unknown): DispatchReconciliationInput["exceptions"][number] | null {
  if (!isRecord(value) || typeof value.productVariantId !== "string" || !isUuid(value.productVariantId)) return null;
  const damagedQuantity = readQuantity(value.damagedQuantity, 10000);
  const missingQuantity = readQuantity(value.missingQuantity, 10000);
  const notes = readText(value.notes, 500);
  if (damagedQuantity === null || missingQuantity === null || notes === null) return null;
  if (damagedQuantity + missingQuantity < 1) return null;
  return { productVariantId: value.productVariantId, damagedQuantity, missingQuantity, notes };
}

function readQuantity(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    && Number.isInteger(value) ? value : null;
}
function readText(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
