import type { DriverDispatch, DriverDispatchStatus, DriverOrder } from "../types/dispatch";

const DISPATCH_STATUSES = new Set<DriverDispatchStatus>([
  "preparing",
  "in_transit",
  "completed",
  "cancelled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`The server returned an invalid ${field}.`);
  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  return value === null ? null : readString(value, field);
}

function readOrder(value: unknown): DriverOrder {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new Error("The server returned an invalid order.");
  const total = value.total;
  if (typeof total !== "number" || !Number.isFinite(total)) {
    throw new Error("The server returned an invalid order total.");
  }
  return {
    id: readString(value.id, "order identifier"),
    referenceNumber: readString(value.referenceNumber, "order reference"),
    status: readString(value.status, "order status"),
    clientName: readString(value.clientName, "client name"),
    clientAddress: readString(value.clientAddress, "client address"),
    clientPhone: readString(value.clientPhone, "client phone"),
    total,
    items: value.items.map((item) => {
      if (!isRecord(item) || typeof item.quantity !== "number" || !Number.isInteger(item.quantity)) {
        throw new Error("The server returned invalid order items.");
      }
      return {
        productVariantId: readString(item.productVariantId, "product variant"),
        productTitle: readString(item.productTitle, "product title"),
        variantLabel: readString(item.variantLabel, "variant label"),
        quantity: item.quantity,
      };
    }),
  };
}

function readDispatch(value: unknown): DriverDispatch {
  if (!isRecord(value) || !isRecord(value.van) || !Array.isArray(value.orders)) {
    throw new Error("The server returned an invalid dispatch.");
  }
  const status = readString(value.status, "dispatch status");
  if (!DISPATCH_STATUSES.has(status as DriverDispatchStatus)) {
    throw new Error("The server returned an unknown dispatch status.");
  }
  return {
    id: readString(value.id, "dispatch identifier"),
    referenceNumber: readString(value.referenceNumber, "dispatch reference"),
    status: status as DriverDispatchStatus,
    vanName: readString(value.van.name, "van name"),
    createdAt: readString(value.createdAt, "dispatch creation date"),
    departedAt: readNullableString(value.departedAt, "departure date"),
    orders: value.orders.map(readOrder),
  };
}

export function parseDriverDispatches(value: unknown): DriverDispatch[] {
  if (!isRecord(value) || !Array.isArray(value.dispatches)) {
    throw new Error("The server returned an invalid dispatch list.");
  }
  return value.dispatches.map(readDispatch);
}
