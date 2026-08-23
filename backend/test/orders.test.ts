import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { Session, User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { OrderActor, OrderRepository } from "../src/repositories/orders.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { AdminOrder, ShipmentInput } from "../src/types/order.js";
import type { MayaCheckoutService } from "../src/services/maya-checkout.js";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "staff@example.com" } as User;
const session = { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user } as Session;
const order: AdminOrder = {
  id: "22222222-2222-4222-8222-222222222222",
  referenceNumber: "33333333-3333-4333-8333-333333333333",
  paymentId: "44444444-4444-4444-8444-444444444444",
  status: "paid",
  total: 640,
  currency: "PHP",
  paidAt: "2026-08-13T00:00:00.000Z",
  createdAt: "2026-08-13T00:00:00.000Z",
  activity: [{
    status: "paid",
    createdAt: "2026-08-13T00:00:00.000Z",
    actorUserId: null,
    actorEmail: null,
    shipment: null,
  }],
  shipment: null,
  customer: { id: "55555555-5555-4555-8555-555555555555", email: "shopper@example.com", firstName: "Ada", lastName: "Lovelace", phone: "+639123456789" },
  shippingAddress: { street: "1 Main Street", region: "Metro Manila", province: "", locality: "Manila", district: "Tondo", barangay: "Barangay 1", postalCode: "1000", country: "Philippines" },
  deliveryNotes: "Ring the bell",
  items: [{ productSlug: "cashew-butter", productTitle: "Cashew Butter", variantLabel: "250g", quantity: 2, unitPrice: 320, lineTotal: 640 }],
};

const auth: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session, user }),
  getUser: async (token) => ({ error: null, user: token === "access-token" ? user : null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

let preparingOrderId: string | null = null;
let preparationActor: OrderActor | null = null;
let preparationAllowed = true;
let shippedOrder: { id: string; shipment: ShipmentInput; actor: OrderActor } | null = null;
let shippingAllowed = true;
let reconciledPaymentId: string | null = null;
const orders: OrderRepository = {
  createPending: async () => undefined,
  attachMayaCheckout: async () => undefined,
  completePaidCheckout: async (paymentId) => {
    reconciledPaymentId = paymentId;
    return { orderId: order.id, created: true };
  },
  list: async () => [order],
  listByCustomer: async () => [order],
  listPendingPaymentIds: async () => [order.paymentId],
  startPreparing: async (id, actor) => {
    preparingOrderId = id;
    preparationActor = actor;
    return preparationAllowed;
  },
  ship: async (id, shipment, actor) => {
    shippedOrder = { id, shipment, actor };
    return shippingAllowed;
  },
};

const maya: MayaCheckoutService = {
  isConfigured: true,
  create: async () => ({ checkoutId: order.paymentId, redirectUrl: "https://payments-web-sandbox.maya.ph/payment" }),
  getPaymentStatus: async () => "PAYMENT_SUCCESS",
};

async function withServer(run: (origin: string) => Promise<void>) {
  const server = createApp({ auth, orders, maya }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("lists paid orders for an authenticated administrator", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders`, { headers: { Cookie: "romana_access_token=access-token" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { orders: [order] });
  });
});

test("lists every order page for an authenticated customer view", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/customers/${order.customer.id}/orders?offset=0`, {
      headers: { Cookie: "romana_access_token=access-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { orders: [order], nextOffset: null });
  });
});

test("starts preparing a paid order with CSRF protection", async () => {
  preparingOrderId = null;
  preparationAllowed = true;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/start-preparing`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "processing" });
    assert.equal(preparingOrderId, order.id);
    assert.deepEqual(preparationActor, { userId: user.id, email: user.email });
  });
});

test("does not start preparation after an order has already advanced", async () => {
  preparationAllowed = false;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/start-preparing`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Only paid orders can start preparation." });
  });
});

test("rejects starting preparation without CSRF protection", async () => {
  preparingOrderId = null;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/start-preparing`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token" },
    });
    assert.equal(response.status, 403);
    assert.equal(preparingOrderId, null);
  });
});

test("marks a processing order as shipped with dispatch details", async () => {
  shippedOrder = null;
  shippingAllowed = true;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ carrier: "LBC Express", trackingNumber: "LBC-123", dispatchNote: "Handed to courier" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "shipped" });
    assert.deepEqual(shippedOrder, {
      id: order.id,
      shipment: { carrier: "LBC Express", trackingNumber: "LBC-123", dispatchNote: "Handed to courier" },
      actor: { userId: user.id, email: user.email },
    });
  });
});

test("rejects incomplete shipment details", async () => {
  shippedOrder = null;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ carrier: "", trackingNumber: "", dispatchNote: "" }),
    });
    assert.equal(response.status, 400);
    assert.equal(shippedOrder, null);
  });
});

test("rejects shipping without CSRF protection", async () => {
  shippedOrder = null;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "romana_access_token=access-token" },
      body: JSON.stringify({ carrier: "LBC Express", trackingNumber: "LBC-123", dispatchNote: "" }),
    });
    assert.equal(response.status, 403);
    assert.equal(shippedOrder, null);
  });
});

test("does not ship an order that is not processing", async () => {
  shippingAllowed = false;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ carrier: "LBC Express", trackingNumber: "LBC-123", dispatchNote: "" }),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Only processing orders can be marked as shipped." });
  });
});

test("reconciles successful checkout sessions when webhooks are unavailable", async () => {
  reconciledPaymentId = null;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/orders/reconcile`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { checked: 1, completed: 1 });
    assert.equal(reconciledPaymentId, order.paymentId);
  });
});
