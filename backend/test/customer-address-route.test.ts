import assert from "node:assert/strict";
import test from "node:test";
import type { Session, User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { ChannelSalesRepository } from "../src/repositories/channel-sales.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { CustomerAddressInput } from "../src/types/channel-sales.js";
import { structuredAddress } from "./channel-sales.fixtures.js";
import { withTestServer } from "./test-server.js";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "staff@example.com", user_metadata: { full_name: "Maria Santos" } } as User;
const session = { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user } as Session;
const customerId = "66666666-6666-4666-8666-666666666666";
const addressId = "88888888-8888-4888-8888-888888888888";
let savedInput: CustomerAddressInput | null = null;

const auth: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session, user }),
  getUser: async () => ({ error: null, user }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

const repository: ChannelSalesRepository = {
  listBaguioSales: async () => [],
  listBaguioDispatches: async () => [],
  listVans: async () => [],
  listBaguioClients: async () => [],
  listOnlineClients: async () => [],
  listCustomers: async () => [],
  createBaguioClient: async () => { throw new Error("Not used"); },
  createCustomerAddress: async (_customerId, input) => {
    savedInput = input;
    return { id: addressId, ...input, formattedAddress: "Session Road, Baguio City, Philippines", isDefault: false };
  },
  createBaguioSale: async () => "",
  updateBaguioSale: async () => false,
  createBaguioDispatch: async () => "",
  advanceBaguioDispatch: async () => false,
  advanceBaguioSale: async () => false,
  completeDriverDelivery: async () => false,
  startDriverTrip: async () => false,
  reconcileDriverDispatch: async () => false,
};

test("adds a validated address to an existing customer", async () => {
  savedInput = null;
  await withTestServer(createApp({ auth, channelSales: repository }), async (origin) => {
    const response = await fetch(`${origin}/api/customers/${customerId}/addresses`, {
      method: "POST",
      headers: { Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "X-CSRF-Token": "csrf-token", "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Warehouse", address: structuredAddress }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(savedInput, { label: "Warehouse", address: structuredAddress });
    assert.equal((await response.json() as { address: { id: string } }).address.id, addressId);
  });
});

test("protects customer address creation with validation and CSRF", async () => {
  await withTestServer(createApp({ auth, channelSales: repository }), async (origin) => {
    const cookie = { Cookie: "romana_access_token=access-token; romana_csrf=csrf-token", "Content-Type": "application/json" };
    const forbidden = await fetch(`${origin}/api/customers/${customerId}/addresses`, { method: "POST", headers: cookie, body: "{}" });
    const invalid = await fetch(`${origin}/api/customers/${customerId}/addresses`, { method: "POST", headers: { ...cookie, "X-CSRF-Token": "csrf-token" }, body: "{}" });
    assert.equal(forbidden.status, 403);
    assert.equal(invalid.status, 400);
  });
});
