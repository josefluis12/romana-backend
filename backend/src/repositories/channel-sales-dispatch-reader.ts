import type {
  BaguioDispatch,
  BaguioSale,
  DispatchReconciliation,
} from "../types/channel-sales.js";
import { readInventoryLocation } from "./channel-sales-readers.js";
import { readDispatchDriver } from "./dispatch-driver-account.js";

export function readBaguioDispatch(
  value: unknown,
  sales: BaguioSale[],
  allocations: unknown[],
  reconciliations: ReadonlyMap<string, DispatchReconciliation>,
): BaguioDispatch {
  if (!isRecord(value) || !isRecord(value.inventory_locations)) throw invalidDispatch();
  const status = readString(value.status);
  if (!["preparing", "ready_for_departure", "in_transit", "completed", "cancelled"].includes(status)) {
    throw invalidDispatch();
  }
  const id = readString(value.id);
  return {
    id,
    referenceNumber: readString(value.reference_number),
    status: status as BaguioDispatch["status"],
    vanLocationId: readString(value.van_location_id),
    van: readInventoryLocation(value.inventory_locations),
    notes: readString(value.notes),
    createdAt: readString(value.created_at),
    departedAt: readNullableString(value.departed_at),
    orders: sales.filter((sale) => sale.dispatchId === id),
    driver: readDispatchDriver(value),
    originalAllocation: readAllocations(allocations, id),
    reconciliation: reconciliations.get(id) ?? null,
  };
}

function readAllocations(values: unknown[], dispatchId: string): BaguioDispatch["originalAllocation"] {
  return values.filter(isRecord).filter((row) => row.dispatch_id === dispatchId).map((row) => ({
    orderId: readString(row.order_id),
    orderReferenceNumber: readString(row.order_reference_number),
    clientName: readString(row.client_name),
    productVariantId: readString(row.product_variant_id),
    productTitle: readString(row.product_title),
    variantLabel: readString(row.variant_label),
    quantity: readNumber(row.quantity),
  }));
}

function readString(value: unknown): string {
  if (typeof value !== "string") throw invalidDispatch();
  return value;
}

function readNullableString(value: unknown): string | null {
  return value === null ? null : readString(value);
}

function readNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw invalidDispatch();
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidDispatch(): Error {
  return new Error("Baguio dispatch storage returned invalid data.");
}
