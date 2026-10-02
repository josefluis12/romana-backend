import assert from "node:assert/strict";
import test from "node:test";
import { validateDriverDeliveryProof } from "../src/schemas/driver-delivery.js";

test("validates a bounded signature and delivery coordinates", () => {
  const proof = {
    signature: [[{ x: 0, y: 0.25 }, { x: 0.75, y: 1 }]],
    latitude: 16.4023,
    longitude: 120.596,
    accuracy: 9.2,
    paymentMode: "cash",
  };
  assert.deepEqual(validateDriverDeliveryProof(proof), { proof });
});

test("rejects missing signatures and coordinates outside valid ranges", () => {
  assert.deepEqual(
    validateDriverDeliveryProof({ signature: [], latitude: 16.4, longitude: 120.6, accuracy: 4, paymentMode: "cash" }),
    { error: "Ask the client to provide a signature." },
  );
  assert.deepEqual(
    validateDriverDeliveryProof({
      signature: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]],
      latitude: 91,
      longitude: 120.6,
      accuracy: 4,
      paymentMode: "cash",
    }),
    { error: "A valid delivery latitude is required." },
  );
});

test("rejects a missing or unsupported payment mode", () => {
  const proof = {
    signature: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]],
    latitude: 16.4,
    longitude: 120.6,
    accuracy: 4,
  };
  assert.deepEqual(validateDriverDeliveryProof(proof), { error: "Select how the client paid." });
  assert.deepEqual(validateDriverDeliveryProof({ ...proof, paymentMode: "card" }), {
    error: "Select how the client paid.",
  });
});
