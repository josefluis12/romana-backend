import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAssignedDriverDispatch } from "../src/repositories/dispatch-reconciliation.js";

test("sends the driver identity and reconciliation when ending an assigned trip", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const input = {
      orders: [{ orderId: "33333333-3333-4333-8333-333333333333", outcome: "failed" as const, collectedAmount: 0, failureReason: "Closed" }],
      exceptions: [],
      notes: "Returned",
    };
    const completed = await reconcileAssignedDriverDispatch(
      "https://example.supabase.co",
      "secret",
      "77777777-7777-4777-8777-777777777777",
      input,
      {
        userId: "55555555-5555-4555-8555-555555555555",
        email: "driver@example.com",
        name: "Demo Driver",
      },
    );
    assert.equal(completed, true);
    assert.deepEqual(requestBody, {
      target_dispatch_id: "77777777-7777-4777-8777-777777777777",
      driver_user_id: "55555555-5555-4555-8555-555555555555",
      driver_email: "driver@example.com",
      order_results: input.orders,
      inventory_exceptions: input.exceptions,
      reconciliation_notes: input.notes,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
