import assert from "node:assert/strict";
import test from "node:test";
import { readSavedDriverDeliveryProof } from "../src/repositories/delivery-proof.js";

test("reads saved signature strokes and delivery coordinates", () => {
  const proof = readSavedDriverDeliveryProof({
    client_signature: [[{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }]],
    signed_at: "2026-10-02T01:00:00.000Z",
    signed_latitude: 16.4023,
    signed_longitude: 120.596,
    location_accuracy: 12,
    signed_by_driver_user_id: "55555555-5555-4555-8555-555555555555",
    payment_mode: "bank_transfer",
  });
  assert.deepEqual(proof, {
    signature: [[{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }]],
    signedAt: "2026-10-02T01:00:00.000Z",
    latitude: 16.4023,
    longitude: 120.596,
    accuracy: 12,
    driverUserId: "55555555-5555-4555-8555-555555555555",
    paymentMode: "bank_transfer",
  });
});

test("supports receipts created before digital delivery proof", () => {
  assert.equal(readSavedDriverDeliveryProof({ client_signature: null }), null);
});

test("supports signed receipts created before payment mode capture", () => {
  const proof = readSavedDriverDeliveryProof({
    client_signature: [[{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }]],
    signed_at: "2026-10-02T01:00:00.000Z",
    signed_latitude: 16.4023,
    signed_longitude: 120.596,
    location_accuracy: 12,
    signed_by_driver_user_id: "55555555-5555-4555-8555-555555555555",
  });
  assert.equal(proof?.paymentMode, null);
});

test("rejects malformed saved signatures", () => {
  assert.throws(
    () => readSavedDriverDeliveryProof({ client_signature: [[{ x: 2, y: 0 }]] }),
    /invalid data/,
  );
});
