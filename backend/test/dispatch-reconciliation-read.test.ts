import assert from "node:assert/strict";
import test from "node:test";
import { loadDispatchReconciliations } from "../src/repositories/dispatch-reconciliation.js";

test("loads reconciliation children without embedding sibling collections together", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    const decodedUrl = decodeURIComponent(url);
    const base = {
      id: "88888888-8888-4888-8888-888888888888",
      dispatch_id: "77777777-7777-4777-8777-777777777777",
      submitted_at: "2026-10-03T00:00:00.000Z",
      total_collected: 640,
      notes: "Complete",
    };
    const value = decodedUrl.includes("baguio_dispatch_reconciliation_orders")
      ? [{
          ...base,
          baguio_dispatch_reconciliation_orders: [{
            order_id: "33333333-3333-4333-8333-333333333333",
            outcome: "delivered",
            collected_amount: 640,
            failure_reason: "",
          }],
        }]
      : [{
          ...base,
          baguio_dispatch_reconciliation_inventory: [{
            product_variant_id: "44444444-4444-4444-8444-444444444444",
            product_title: "Cashew Butter",
            variant_label: "250g",
            allocated_quantity: 2,
            delivered_quantity: 2,
            returned_quantity: 0,
            damaged_quantity: 0,
            missing_quantity: 0,
            remaining_quantity: 0,
            notes: "",
          }],
        }];
    return Response.json(value);
  };

  try {
    const reconciliations = await loadDispatchReconciliations(
      "https://example.supabase.co",
      "secret",
      ["77777777-7777-4777-8777-777777777777"],
    );

    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.every((url) => {
      const decodedUrl = decodeURIComponent(url);
      return !(decodedUrl.includes("baguio_dispatch_reconciliation_orders")
        && decodedUrl.includes("baguio_dispatch_reconciliation_inventory"));
    }));
    assert.deepEqual(reconciliations.get("77777777-7777-4777-8777-777777777777"), {
      submittedAt: "2026-10-03T00:00:00.000Z",
      totalCollected: 640,
      notes: "Complete",
      orders: [{
        orderId: "33333333-3333-4333-8333-333333333333",
        outcome: "delivered",
        collectedAmount: 640,
        failureReason: "",
      }],
      inventory: [{
        productVariantId: "44444444-4444-4444-8444-444444444444",
        productTitle: "Cashew Butter",
        variantLabel: "250g",
        allocatedQuantity: 2,
        deliveredQuantity: 2,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        remainingQuantity: 0,
        notes: "",
      }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
