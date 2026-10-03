import type { PaymentMode, SavedDriverDeliveryProof, SignaturePoint } from "../types/channel-sales.js";

const PAYMENT_MODES: PaymentMode[] = ["cash", "gcash", "maya", "bank_transfer", "cheque"];

export function readSavedDriverDeliveryProof(
  value: Record<string, unknown>,
): SavedDriverDeliveryProof | null {
  if (value.client_signature === null) return null;
  return {
    signature: readSignature(value.client_signature),
    signedAt: readString(value.signed_at),
    latitude: readNumber(value.signed_latitude),
    longitude: readNumber(value.signed_longitude),
    accuracy: readNumber(value.location_accuracy),
    driverUserId: readString(value.signed_by_driver_user_id),
    paymentMode: readNullablePaymentMode(value.payment_mode),
    collectedAmount: readNullableNumber(value.collected_amount),
  };
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return readNumber(value);
}

function readNullablePaymentMode(value: unknown): PaymentMode | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && PAYMENT_MODES.includes(value as PaymentMode)) {
    return value as PaymentMode;
  }
  throw invalidProof();
}

function readSignature(value: unknown): SignaturePoint[][] {
  if (!Array.isArray(value) || value.length === 0) throw invalidProof();
  return value.map((stroke) => {
    if (!Array.isArray(stroke) || stroke.length < 2) throw invalidProof();
    return stroke.map((point) => {
      if (!isRecord(point)) throw invalidProof();
      const x = readNumber(point.x);
      const y = readNumber(point.y);
      if (x < 0 || x > 1 || y < 0 || y > 1) throw invalidProof();
      return { x, y };
    });
  });
}

function readNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw invalidProof();
  return number;
}

function readString(value: unknown): string {
  if (typeof value !== "string" || !value) throw invalidProof();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidProof(): Error {
  return new Error("Delivery proof storage returned invalid data.");
}
