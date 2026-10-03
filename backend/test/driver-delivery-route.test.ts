import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { User } from "@supabase/supabase-js";
import { registerDispatchDriverRoutes } from "../src/routes/dispatch-drivers.js";
import type { ChannelSaleActor, ChannelSalesRepository } from "../src/repositories/channel-sales.js";
import type { DispatchReconciliationInput, DriverDeliveryProof } from "../src/types/channel-sales.js";
import type { SystemUserService } from "../src/services/system-users.js";
import { withTestServer } from "./test-server.js";

const orderId = "33333333-3333-4333-8333-333333333333";
const dispatchId = "77777777-7777-4777-8777-777777777777";
const driver = {
  id: "55555555-5555-4555-8555-555555555555",
  email: "driver@example.com",
  app_metadata: { role: "dispatch_driver" },
  user_metadata: { first_name: "Demo", last_name: "Driver" },
} as User;
const administrator = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  app_metadata: { role: "admin" },
} as User;
const proof: DriverDeliveryProof = {
  signature: [[{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 }]],
  latitude: 16.4023,
  longitude: 120.596,
  accuracy: 8.5,
  paymentMode: "gcash",
  collectedAmount: 640.5,
};

let completed: { id: string; proof: DriverDeliveryProof; actor: ChannelSaleActor } | null;
let startedDispatch: { id: string; actor: ChannelSaleActor } | null;
let completedDispatch: { id: string; input: DispatchReconciliationInput; actor: ChannelSaleActor } | null;
let allowTripStart = true;
let allowTripCompletion = true;

function createRepository(): ChannelSalesRepository {
  return {
    listBaguioSales: async () => [],
    listBaguioDispatches: async () => [],
    listVans: async () => [],
    listBaguioClients: async () => [],
    listOnlineClients: async () => [],
    listCustomers: async () => [],
    createBaguioClient: async () => { throw new Error("Not used"); },
    createCustomerAddress: async () => { throw new Error("Not used"); },
    createBaguioSale: async () => "",
    updateBaguioSale: async () => false,
    createBaguioDispatch: async () => "",
    advanceBaguioDispatch: async () => false,
    advanceBaguioSale: async () => false,
    completeDriverDelivery: async (id, nextProof, actor) => {
      completed = { id, proof: nextProof, actor };
      return true;
    },
    startDriverTrip: async (id, actor) => {
      startedDispatch = { id, actor };
      return allowTripStart;
    },
    reconcileDriverDispatch: async (id, input, actor) => {
      completedDispatch = { id, input, actor };
      return allowTripCompletion;
    },
  };
}

test("assigned driver starts a released trip", async () => {
  startedDispatch = null;
  allowTripStart = true;
  await withTestServer(createTestApp(), async (origin) => {
    const response = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/start`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "in_transit" });
    assert.deepEqual(startedDispatch, {
      id: dispatchId,
      actor: { userId: driver.id, email: driver.email, name: "Demo Driver" },
    });
  });
});

test("driver cannot start an unavailable trip", async () => {
  allowTripStart = false;
  await withTestServer(createTestApp(), async (origin) => {
    const rejected = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/start`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token" },
    });
    const forbidden = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/start`, {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    });
    assert.equal(rejected.status, 409);
    assert.equal(forbidden.status, 403);
  });
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  const users = { listDrivers: async () => [] } as SystemUserService;
  registerDispatchDriverRoutes(app, users, createRepository(), async (request) => ({
    user: request.header("authorization") === "Bearer driver-token" ? driver : administrator,
    cookies: {},
  }));
  return app;
}

test("driver saves a client signature and coordinates for a delivery", async () => {
  completed = null;
  await withTestServer(createTestApp(), async (origin) => {
    const response = await fetch(`${origin}/api/driver/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token", "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "delivered" });
    assert.deepEqual(completed, {
      id: orderId,
      proof,
      actor: { userId: driver.id, email: driver.email, name: "Demo Driver" },
    });
  });
});

test("delivery endpoint rejects invalid proof and non-driver users", async () => {
  await withTestServer(createTestApp(), async (origin) => {
    const invalid = await fetch(`${origin}/api/driver/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token", "Content-Type": "application/json" },
      body: JSON.stringify({ signature: [], latitude: 16.4, longitude: 120.6, accuracy: 5, paymentMode: "cash", collectedAmount: 640 }),
    });
    const forbidden = await fetch(`${origin}/api/driver/orders/${orderId}/deliver`, {
      method: "POST",
      headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    });
    assert.equal(invalid.status, 400);
    assert.equal(forbidden.status, 403);
  });
});

const reconciliation: DispatchReconciliationInput = {
  orders: [{ orderId, outcome: "failed", failureReason: "Customer unavailable" }],
  exceptions: [],
  notes: "Returned to factory",
};

test("assigned driver reconciles and ends a trip", async () => {
  completedDispatch = null;
  allowTripCompletion = true;
  await withTestServer(createTestApp(), async (origin) => {
    const response = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/reconcile`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token", "Content-Type": "application/json" },
      body: JSON.stringify(reconciliation),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "completed", reconciliation: "submitted" });
    assert.deepEqual(completedDispatch, {
      id: dispatchId,
      input: reconciliation,
      actor: { userId: driver.id, email: driver.email, name: "Demo Driver" },
    });
  });
});

test("driver cannot submit an invalid or rejected reconciliation", async () => {
  allowTripCompletion = false;
  await withTestServer(createTestApp(), async (origin) => {
    const response = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/reconcile`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token", "Content-Type": "application/json" },
      body: JSON.stringify(reconciliation),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "This trip cannot be reconciled. Refresh the dispatch and review every order." });
    const forbidden = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/reconcile`, {
      method: "POST",
      headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify(reconciliation),
    });
    assert.equal(forbidden.status, 403);
  });
});

test("reconciliation requires a failure reason", async () => {
  await withTestServer(createTestApp(), async (origin) => {
    const response = await fetch(`${origin}/api/driver/dispatches/${dispatchId}/reconcile`, {
      method: "POST",
      headers: { Authorization: "Bearer driver-token", "Content-Type": "application/json" },
      body: JSON.stringify({ ...reconciliation, orders: [{ ...reconciliation.orders[0], failureReason: "" }] }),
    });
    assert.equal(response.status, 400);
  });
});
