import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseOrderRepository } from "../src/repositories/orders.js";

test("reads legacy order activity without shipment metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: "22222222-2222-4222-8222-222222222222",
    request_reference_number: "33333333-3333-4333-8333-333333333333",
    maya_payment_id: "44444444-4444-4444-8444-444444444444",
    status: "processing",
    total: 640,
    currency: "PHP",
    shipping_address: {
      street: "1 Main Street",
      region: "Metro Manila",
      province: "",
      locality: "Manila",
      district: "Tondo",
      barangay: "Barangay 1",
      postalCode: "1000",
    },
    delivery_notes: "",
    paid_at: "2026-08-13T00:00:00.000Z",
    created_at: "2026-08-13T00:00:00.000Z",
    shipping_carrier: null,
    tracking_number: null,
    dispatch_note: "",
    dispatched_at: null,
    customer_email: "shopper@example.com",
    customer_first_name: "Ada",
    customer_last_name: "Lovelace",
    customer_phone: "+639123456789",
    customers: {
      id: "55555555-5555-4555-8555-555555555555",
    },
    order_items: [{
      product_slug: "cashew-butter",
      product_title: "Cashew Butter",
      variant_label: "250g",
      quantity: 2,
      unit_price: 320,
      line_total: 640,
    }],
    order_status_events: [{
      status: "paid",
      created_at: "2026-08-13T00:00:00.000Z",
      actor_user_id: null,
      actor_email: null,
      metadata: {},
    }],
  }]), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const orders = await createSupabaseOrderRepository("https://example.supabase.co", "secret").list();
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.customer.email, "shopper@example.com");
    assert.equal(orders[0]?.customer.id, "55555555-5555-4555-8555-555555555555");
    assert.equal(orders[0]?.activity[0]?.shipment, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
