import type { ShipmentInput } from "../types/order.js";

export interface ShipmentValidation {
  shipment?: ShipmentInput;
  error?: string;
}

export function validateShipmentInput(value: unknown): ShipmentValidation {
  if (!isRecord(value)) return { error: "Shipment details are required." };
  const carrier = readTrimmedString(value.carrier);
  const trackingNumber = readTrimmedString(value.trackingNumber);
  const dispatchNote = readTrimmedString(value.dispatchNote) ?? "";

  if (!carrier || carrier.length < 2 || carrier.length > 100) {
    return { error: "Enter a carrier between 2 and 100 characters." };
  }
  if (!trackingNumber || trackingNumber.length < 2 || trackingNumber.length > 100) {
    return { error: "Enter a tracking number between 2 and 100 characters." };
  }
  if (dispatchNote.length > 500) return { error: "Dispatch notes cannot exceed 500 characters." };
  return { shipment: { carrier, trackingNumber, dispatchNote } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}
