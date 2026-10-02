import type { DriverDeliveryProof, PaymentMode, SignaturePoint } from "../types/channel-sales.js";

interface DriverDeliveryValidation {
  proof?: DriverDeliveryProof;
  error?: string;
}

const MAX_SIGNATURE_POINTS = 400;
const PAYMENT_MODES: PaymentMode[] = ["cash", "gcash", "maya", "bank_transfer", "cheque"];

export function validateDriverDeliveryProof(value: unknown): DriverDeliveryValidation {
  if (!isRecord(value)) return { error: "Delivery proof is required." };
  const signature = readSignature(value.signature);
  if (!signature) return { error: "Ask the client to provide a signature." };
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  const accuracy = readFiniteNumber(value.accuracy);
  const paymentMode = readPaymentMode(value.paymentMode);
  if (latitude === null || latitude < -90 || latitude > 90) {
    return { error: "A valid delivery latitude is required." };
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    return { error: "A valid delivery longitude is required." };
  }
  if (accuracy === null || accuracy < 0 || accuracy > 10_000) {
    return { error: "Valid location accuracy is required." };
  }
  if (!paymentMode) return { error: "Select how the client paid." };
  return { proof: { signature, latitude, longitude, accuracy, paymentMode } };
}

function readPaymentMode(value: unknown): PaymentMode | null {
  return typeof value === "string" && PAYMENT_MODES.includes(value as PaymentMode)
    ? value as PaymentMode
    : null;
}

function readSignature(value: unknown): SignaturePoint[][] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  let pointCount = 0;
  const strokes: SignaturePoint[][] = [];
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length < 2) return null;
    const points: SignaturePoint[] = [];
    for (const point of stroke) {
      if (!isRecord(point)) return null;
      const x = readFiniteNumber(point.x);
      const y = readFiniteNumber(point.y);
      if (x === null || y === null || x < 0 || x > 1 || y < 0 || y > 1) return null;
      points.push({ x, y });
      pointCount += 1;
      if (pointCount > MAX_SIGNATURE_POINTS) return null;
    }
    strokes.push(points);
  }
  return strokes;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
