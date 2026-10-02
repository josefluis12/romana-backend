import assert from "node:assert/strict";
import test from "node:test";
import { parseDriverDispatches } from "../src/services/dispatch-parser.ts";

test("maps the driver API response to the mobile dispatch contract", () => {
  const dispatches = parseDriverDispatches({
    dispatches: [{
      id: "dispatch-1",
      referenceNumber: "DSP-001",
      status: "in_transit",
      van: { name: "Baguio Van 1" },
      createdAt: "2026-10-02T01:00:00.000Z",
      departedAt: "2026-10-02T02:00:00.000Z",
      orders: [{
        id: "order-1",
        referenceNumber: "BS-001",
        status: "in_transit",
        clientName: "Sample Store",
        clientAddress: "Session Road, Baguio City",
        clientPhone: "+639171234567",
        total: 1250,
        items: [{
          productVariantId: "variant-1",
          productTitle: "Ube Jam",
          variantLabel: "12 oz",
          quantity: 2,
        }],
      }],
    }],
  });

  assert.equal(dispatches[0]?.vanName, "Baguio Van 1");
  assert.equal(dispatches[0]?.orders[0]?.clientName, "Sample Store");
  assert.equal(dispatches[0]?.orders[0]?.items[0]?.quantity, 2);
});

test("rejects malformed dispatch responses", () => {
  assert.throws(
    () => parseDriverDispatches({ dispatches: [{ status: "unknown" }] }),
    /invalid dispatch/,
  );
});
