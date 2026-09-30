import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { Session, User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { ChannelSaleActor, ChannelSalesRepository } from "../src/repositories/channel-sales.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { BaguioClient, BaguioDispatch, BaguioDispatchAction, BaguioDispatchInput, BaguioSale, BaguioSaleAction, BaguioSaleInput, BaguioSaleUpdateInput, DispatchDriver, InventoryLocation } from "../src/types/channel-sales.js";
import type { DispatchDriverService } from "../src/services/dispatch-drivers.js";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "staff@example.com", user_metadata: { full_name: "Maria Santos" } } as User;
const driverUser = { id: "55555555-5555-4555-8555-555555555555", email: "driver@example.com", app_metadata: { role: "dispatch_driver" }, user_metadata: { first_name: "Demo", middle_name: "Sample", last_name: "Driver" } } as User;
const driver: DispatchDriver = { userId: driverUser.id, name: "Demo Sample Driver", email: "driver@example.com" };
const actor = { userId: user.id, email: user.email, name: "Maria Santos" };
const session = { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user } as Session;
const van: InventoryLocation = { id: "22222222-2222-4222-8222-222222222222", code: "baguio-van-1", name: "Baguio Van 1", type: "vehicle" };
const structuredAddress = {
  street: "Session Road",
  region: "Cordillera Administrative Region (CAR)",
  province: "Benguet",
  locality: "Baguio City",
  district: "",
  barangay: "Session Road Area",
  postalCode: "2600",
  country: "Philippines" as const,
};
const client: BaguioClient = { id: "66666666-6666-4666-8666-666666666666", referenceNumber: "BGC-000001", name: "Baguio Market", address: "Session Road, Session Road Area, Baguio City, Benguet, Cordillera Administrative Region (CAR), 2600, Philippines", structuredAddress, phone: "09171234567", email: "buyer@example.com", contactPerson: "Ana Cruz", isActive: true, createdAt: "2026-09-28T00:00:00.000Z" };
const sale: BaguioSale = {
  id: "33333333-3333-4333-8333-333333333333",
  referenceNumber: "BAG-000001",
  status: "draft",
  clientName: "Baguio Market",
  clientAddress: "Session Road, Baguio City",
  clientPhone: "09171234567",
  customerId: client.id,
  dispatchId: "77777777-7777-4777-8777-777777777777",
  addedAfterDeparture: false,
  revisionCount: 0,
  deliveryNotes: "Morning delivery",
  van,
  total: 640,
  createdAt: "2026-09-28T00:00:00.000Z",
  deliveryOrder: { number: "DOF-000001", status: "draft", preparedByName: "Maria Santos" },
  deliveryReceipt: { number: "DR-000001", status: "pending", clientAcknowledgedAt: null },
  items: [{ productVariantId: "44444444-4444-4444-8444-444444444444", productTitle: "Cashew Butter", variantLabel: "250g", quantity: 2, unitPrice: 320, lineTotal: 640 }],
};
const input: BaguioSaleInput = {
  customerId: client.id,
  dispatchId: sale.dispatchId,
  deliveryNotes: sale.deliveryNotes,
  items: sale.items.map(({ productVariantId, quantity, unitPrice }) => ({ productVariantId, quantity, unitPrice })),
};
const dispatch: BaguioDispatch = { id: sale.dispatchId, referenceNumber: "DSP-000001", status: "preparing", vanLocationId: van.id, van, driver, notes: "Morning run", createdAt: sale.createdAt, departedAt: null, orders: [sale], originalAllocation: [] };

const auth: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session, user }),
  getUser: async (token) => ({ error: null, user: token === "access-token" ? user : token === "driver-token" ? driverUser : null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

let created: { input: BaguioSaleInput; actor: ChannelSaleActor } | null = null;
let advanced: { id: string; action: BaguioSaleAction; actor: ChannelSaleActor } | null = null;
let allowAdvance = true;
let createdDispatch: { input: BaguioDispatchInput; actor: ChannelSaleActor } | null = null;
let advancedDispatch: { id: string; action: BaguioDispatchAction; actor: ChannelSaleActor } | null = null;
let revised: { id: string; input: BaguioSaleUpdateInput; actor: ChannelSaleActor } | null = null;
let listedForDriver: string | undefined;
const repository: ChannelSalesRepository = {
  listBaguioSales: async () => [sale],
  listBaguioDispatches: async (driverUserId) => { listedForDriver = driverUserId; return [dispatch]; },
  listVans: async () => [van],
  listBaguioClients: async () => [client],
  listOnlineClients: async () => [client],
  listCustomers: async () => [client],
  createBaguioClient: async () => client,
  createBaguioSale: async (nextInput, actor) => {
    created = { input: nextInput, actor };
    return sale.id;
  },
  updateBaguioSale: async (id, nextInput, actor) => { revised = { id, input: nextInput, actor }; return allowAdvance; },
  createBaguioDispatch: async (nextInput, actor) => { createdDispatch = { input: nextInput, actor }; return dispatch.id; },
  advanceBaguioDispatch: async (id, action, actor) => { advancedDispatch = { id, action, actor }; return allowAdvance; },
  advanceBaguioSale: async (id, action, actor) => {
    advanced = { id, action, actor };
    return allowAdvance;
  },
};
const dispatchDrivers: DispatchDriverService = {
  list: async () => [driver],
  create: async (account) => ({
    userId: driver.userId,
    name: [account.firstName, account.middleName, account.lastName].filter(Boolean).join(" "),
    email: account.email,
  }),
};

async function withServer(run: (origin: string) => Promise<void>) {
  const server = createApp({ auth, channelSales: repository, dispatchDrivers }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

const cookie = "romana_access_token=access-token; romana_csrf=csrf-token";

test("lists Baguio sales and vehicle inventory locations", async () => {
  await withServer(async (origin) => {
    const headers = { Cookie: cookie };
    const salesResponse = await fetch(`${origin}/api/channel-sales/baguio`, { headers });
    const vehiclesResponse = await fetch(`${origin}/api/inventory/vehicles`, { headers });
    assert.equal(salesResponse.status, 200);
    assert.deepEqual(await salesResponse.json(), { sales: [sale] });
    assert.deepEqual(await vehiclesResponse.json(), { vehicles: [van] });
  });
});

test("creates and starts a dispatch that owns multiple orders", async () => {
  createdDispatch = null; advancedDispatch = null; allowAdvance = true;
  await withServer(async (origin) => {
    const headers = { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" };
    const list = await fetch(`${origin}/api/channel-sales/baguio/dispatches`, { headers });
    assert.deepEqual(await list.json(), { dispatches: [dispatch] });
    const createdResponse = await fetch(`${origin}/api/channel-sales/baguio/dispatches`, { method: "POST", headers, body: JSON.stringify({ vanLocationId: van.id, driverUserId: driver.userId, notes: dispatch.notes }) });
    assert.equal(createdResponse.status, 201);
    assert.deepEqual(createdDispatch, { input: { vanLocationId: van.id, driverUserId: driver.userId, notes: dispatch.notes }, actor });
    const started = await fetch(`${origin}/api/channel-sales/baguio/dispatches/${dispatch.id}/start`, { method: "POST", headers });
    assert.equal(started.status, 200);
    assert.deepEqual(await started.json(), { status: "in_transit" });
    assert.deepEqual(advancedDispatch, { id: dispatch.id, action: "start", actor });
  });
});

test("creates driver accounts and restricts driver dispatches by authenticated user", async () => {
  listedForDriver = undefined;
  await withServer(async (origin) => {
    const createdAccount = await fetch(`${origin}/api/dispatch-drivers`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ firstName: "Demo", middleName: "Sample", lastName: "Driver", email: driver.email, temporaryPassword: "temporary-pass-123" }),
    });
    assert.equal(createdAccount.status, 201);
    assert.deepEqual(await createdAccount.json(), { driver });

    const assigned = await fetch(`${origin}/api/driver/dispatches`, { headers: { Authorization: "Bearer driver-token" } });
    assert.equal(assigned.status, 200);
    assert.deepEqual(await assigned.json(), { dispatches: [dispatch] });
    assert.equal(listedForDriver, driver.userId);

    const forbidden = await fetch(`${origin}/api/channel-sales/baguio`, { headers: { Authorization: "Bearer driver-token" } });
    assert.equal(forbidden.status, 403);
  });
});

test("lists and registers clients in the Baguio directory", async () => {
  await withServer(async (origin) => {
    const headers = { Cookie: cookie };
    const listResponse = await fetch(`${origin}/api/customers/directory/baguio`, { headers });
    assert.deepEqual(await listResponse.json(), { customers: [client], nextOffset: null });
    const response = await fetch(`${origin}/api/customers`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ name: client.name, address: structuredAddress, phone: client.phone, email: client.email, contactPerson: client.contactPerson }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { client });
  });
});

test("rejects incomplete Baguio customer addresses", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/customers`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ name: client.name, address: { ...structuredAddress, barangay: "" }, phone: client.phone, email: client.email, contactPerson: client.contactPerson }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Enter a complete Philippine delivery address." });
  });
});

test("lists customers from the shared directory", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/customers/directory?offset=0`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { customers: [client], nextOffset: null });
  });
});

test("lists website customers from the online channel", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/customers/directory/online?offset=0`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { customers: [client], nextOffset: null });
  });
});

test("creates a validated Baguio sale with pending documents", async () => {
  created = null;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/channel-sales/baguio`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, preparedByName: "Spoofed Name" }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { id: sale.id });
    assert.deepEqual(created, { input, actor });
  });
});

test("rejects invalid and unprotected Baguio sale creation", async () => {
  await withServer(async (origin) => {
    const invalid = await fetch(`${origin}/api/channel-sales/baguio`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, items: [] }),
    });
    const unprotected = await fetch(`${origin}/api/channel-sales/baguio`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const duplicate = await fetch(`${origin}/api/channel-sales/baguio`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, items: [input.items[0], input.items[0]] }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(unprotected.status, 403);
    assert.equal(duplicate.status, 400);
    assert.deepEqual(await duplicate.json(), { error: "Add each product variant only once." });
  });
});

test("revises order items for inventory reallocation", async () => {
  revised = null; allowAdvance = true;
  const update = { deliveryNotes: "Add two cases", items: [{ ...input.items[0], quantity: 4 }] };
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/channel-sales/baguio/${sale.id}`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify(update),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { updated: true });
    assert.deepEqual(revised, { id: sale.id, input: update, actor });
  });
});

test("rejects revisions after an order is closed", async () => {
  allowAdvance = false;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/channel-sales/baguio/${sale.id}`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ deliveryNotes: "", items: input.items }),
    });
    assert.equal(response.status, 409);
  });
});

test("advances a Baguio sale through an explicit action", async () => {
  advanced = null;
  allowAdvance = true;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/channel-sales/baguio/${sale.id}/load`, {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": "csrf-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "loaded" });
    assert.deepEqual(advanced, { id: sale.id, action: "load", actor });
  });
});

test("reports an invalid workflow transition as a conflict", async () => {
  allowAdvance = false;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/channel-sales/baguio/${sale.id}/complete`, {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": "csrf-token" },
    });
    assert.equal(response.status, 409);
  });
});
