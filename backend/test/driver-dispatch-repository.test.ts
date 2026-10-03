import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAssignedDriverDispatch } from "../src/repositories/dispatch-reconciliation.js";
import { startAssignedDriverTrip } from "../src/repositories/driver-trip.js";

test("sends the authenticated driver identity when starting a trip", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: unknown;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return Response.json(true);
  };
  try {
    const started = await startAssignedDriverTrip(
      "https://example.supabase.co",
      "secret",
      "77777777-7777-4777-8777-777777777777",
      { userId: "55555555-5555-4555-8555-555555555555", email: "driver@example.com", name: "Demo Driver" },
    );
    assert.equal(started, true);
    assert.equal(requestUrl, "https://example.supabase.co/rest/v1/rpc/start_driver_trip");
    assert.deepEqual(requestBody, {
      target_dispatch_id: "77777777-7777-4777-8777-777777777777",
      authenticated_driver_user_id: "55555555-5555-4555-8555-555555555555",
      driver_email: "driver@example.com",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sends the driver identity and reconciliation when ending an assigned trip", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const input = {
      orders: [{ orderId: "33333333-3333-4333-8333-333333333333", outcome: "failed" as const, failureReason: "Closed" }],
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
      order_results: [{ ...input.orders[0], collectedAmount: 0 }],
      inventory_exceptions: input.exceptions,
      reconciliation_notes: input.notes,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses the amount captured during delivery when reconciling a delivered order", async () => {
  const originalFetch = globalThis.fetch;
  let reconciliationBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/delivery_receipts?")) {
      return Response.json([{ order_id: "33333333-3333-4333-8333-333333333333", collected_amount: 725.5 }]);
    }
    reconciliationBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json(true);
  };

  try {
    const input = {
      orders: [{ orderId: "33333333-3333-4333-8333-333333333333", outcome: "delivered" as const, failureReason: "" }],
      exceptions: [],
      notes: "Complete",
    };
    await reconcileAssignedDriverDispatch(
      "https://example.supabase.co",
      "secret",
      "77777777-7777-4777-8777-777777777777",
      input,
      { userId: "55555555-5555-4555-8555-555555555555", email: "driver@example.com", name: "Demo Driver" },
    );
    assert.deepEqual(reconciliationBody?.order_results, [{ ...input.orders[0], collectedAmount: 725.5 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
