import assert from "node:assert/strict";
import test from "node:test";
import { completeDriverDelivery } from "../src/repositories/driver-delivery.js";

test("sends the selected payment mode with the delivery proof", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const changed = await completeDriverDelivery(
      "https://example.supabase.co",
      "secret",
      "33333333-3333-4333-8333-333333333333",
      {
        signature: [[{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 }]],
        latitude: 16.4023,
        longitude: 120.596,
        accuracy: 8.5,
        paymentMode: "gcash",
      },
      {
        userId: "55555555-5555-4555-8555-555555555555",
        email: "driver@example.com",
        name: "Demo Driver",
      },
    );

    assert.equal(changed, true);
    assert.equal((requestBody as Record<string, unknown>).p_payment_mode, "gcash");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
