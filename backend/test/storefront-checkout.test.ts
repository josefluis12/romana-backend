import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.js";
import type { ProductRepository } from "../src/repositories/products.js";
import type { OrderRepository } from "../src/repositories/orders.js";
import type { MayaCheckoutService, MayaLineItem } from "../src/services/maya-checkout.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { Product } from "../src/types/product.js";

const product: Product = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "cashew-butter",
  title: "Cashew Butter",
  category: "Spreads",
  bestSeller: true,
  isActive: true,
  ingredients: ["Cashews"],
  allergens: ["Cashews"],
  short: "Creamy cashew butter.",
  variants: [{ id: "variant-1", label: "250g", price: 320, image: "/cashew.png" }],
  createdAt: "2026-08-13T00:00:00.000Z",
};

const auth: AuthService = {
  isConfigured: false,
  signIn: async () => ({ error: null, session: null, user: null }),
  getUser: async () => ({ error: null, user: null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

function repository(): ProductRepository {
  return {
    list: async () => [product],
    listPublic: async () => [product],
    create: async () => product,
    update: async () => product,
    setActive: async () => product,
  };
}

async function withServer(maya: MayaCheckoutService, run: (origin: string) => Promise<void>) {
  const server = createApp({ auth, products: repository(), maya, orders }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

let pendingCheckout: Parameters<OrderRepository["createPending"]>[0] | null = null;
let attachedCheckout: { reference: string; checkoutId: string } | null = null;
let completedPaymentId: string | null = null;
const orders: OrderRepository = {
  createPending: async (checkout) => { pendingCheckout = checkout; },
  attachMayaCheckout: async (reference, checkoutId) => { attachedCheckout = { reference, checkoutId }; },
  completePaidCheckout: async (paymentId) => {
    completedPaymentId = paymentId;
    return { orderId: "22222222-2222-4222-8222-222222222222", created: true };
  },
  list: async () => [],
  listByCustomer: async () => [],
  listPendingPaymentIds: async () => [],
  startPreparing: async () => false,
  ship: async () => false,
};

const checkoutDetails = {
  customer: { email: " Shopper@Example.com ", firstName: "Ada", lastName: "Lovelace", phone: "+63 912 345 6789" },
  shippingAddress: {
    street: "1 Main Street",
    region: "Metro Manila",
    province: "",
    locality: "Manila",
    district: "Tondo",
    barangay: "Barangay 1",
    postalCode: "1000",
    country: "Philippines",
  },
  deliveryNotes: "Ring the bell",
};

test("creates a Maya checkout using catalog prices", async () => {
  let received: MayaLineItem[] = [];
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async (items) => {
      received = items;
      return { checkoutId: "checkout-id", redirectUrl: "https://payments-web-sandbox.paymaya.com/checkout-id" };
    },
    getPaymentStatus: async () => "PAYMENT_SUCCESS",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/storefront/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...checkoutDetails, items: [{ slug: "cashew-butter", size: "250g", quantity: 2, price: 1 }] }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      checkoutId: "checkout-id",
      redirectUrl: "https://payments-web-sandbox.paymaya.com/checkout-id",
    });
    assert.equal(received[0]?.unitPrice, 320);
    assert.equal(received[0]?.quantity, 2);
    assert.equal(pendingCheckout?.customer.email, "shopper@example.com");
    assert.equal(pendingCheckout?.customer.phone, "+639123456789");
    assert.equal(pendingCheckout?.total, 640);
    assert.equal(attachedCheckout?.checkoutId, "checkout-id");
  });
});

test("rejects unavailable cart variants before calling Maya", async () => {
  let called = false;
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async () => {
      called = true;
      throw new Error("Unexpected call");
    },
    getPaymentStatus: async () => "PAYMENT_FAILED",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/storefront/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...checkoutDetails, items: [{ slug: "cashew-butter", size: "1kg", quantity: 1 }] }),
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

test("creates an order once Maya verifies a successful payment", async () => {
  const paymentId = "33333333-3333-4333-8333-333333333333";
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async () => ({ checkoutId: paymentId, redirectUrl: "https://payments-web-sandbox.maya.ph/payment" }),
    getPaymentStatus: async () => "PAYMENT_SUCCESS",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/maya`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: paymentId, paymentStatus: "PAYMENT_SUCCESS" }),
    });
    assert.equal(response.status, 200);
    assert.equal(completedPaymentId, paymentId);
    assert.deepEqual(await response.json(), { accepted: true, orderId: "22222222-2222-4222-8222-222222222222" });
  });
});

test("completes an order from the storefront return when a webhook is unavailable", async () => {
  completedPaymentId = null;
  const paymentId = "55555555-5555-4555-8555-555555555555";
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async () => ({ checkoutId: paymentId, redirectUrl: "https://payments-web-sandbox.maya.ph/payment" }),
    getPaymentStatus: async () => "PAYMENT_SUCCESS",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/storefront/checkouts/${paymentId}/complete`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.equal(completedPaymentId, paymentId);
    assert.deepEqual(await response.json(), { orderId: "22222222-2222-4222-8222-222222222222", created: true });
  });
});

test("does not complete an unpaid storefront checkout", async () => {
  completedPaymentId = null;
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async () => ({ checkoutId: "unused", redirectUrl: "https://payments-web-sandbox.maya.ph/payment" }),
    getPaymentStatus: async () => "PAYMENT_FAILED",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/storefront/checkouts/66666666-6666-4666-8666-666666666666/complete`, { method: "POST" });
    assert.equal(response.status, 400);
    assert.equal(completedPaymentId, null);
  });
});

test("does not create an order when Maya does not verify success", async () => {
  completedPaymentId = null;
  const maya: MayaCheckoutService = {
    isConfigured: true,
    create: async () => ({ checkoutId: "unused", redirectUrl: "https://payments-web-sandbox.maya.ph/payment" }),
    getPaymentStatus: async () => "PAYMENT_FAILED",
  };
  await withServer(maya, async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/maya`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "44444444-4444-4444-8444-444444444444", paymentStatus: "PAYMENT_SUCCESS" }),
    });
    assert.equal(response.status, 400);
    assert.equal(completedPaymentId, null);
  });
});
