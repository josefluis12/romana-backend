import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { User } from "@supabase/supabase-js";
import { registerDispatchDriverRoutes } from "../src/routes/dispatch-drivers.js";
import type { ChannelSalesRepository } from "../src/repositories/channel-sales.js";
import type { DriverRoutingService } from "../src/services/driver-routing.js";
import type { SystemUserService } from "../src/services/system-users.js";
import type { BaguioDispatch } from "../src/types/channel-sales.js";
import { withTestServer } from "./test-server.js";

const dispatchId = "77777777-7777-4777-8777-777777777777";
const administrator = { id: "11111111-1111-4111-8111-111111111111", app_metadata: { role: "admin" } } as User;
const driver = { id: "55555555-5555-4555-8555-555555555555", app_metadata: { role: "dispatch_driver" } } as User;

test("serves the Google route map to administrators only", async () => {
  let mappedOrderCount = 0;
  const dispatch = { id: dispatchId, orders: [{ id: "order-1" }] } as BaguioDispatch;
  const repository = { listBaguioDispatches: async () => [dispatch] } as ChannelSalesRepository;
  const routing = {
    isConfigured: true,
    createStaticMap: async (orders) => {
      mappedOrderCount = orders.length;
      return { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: "image/png" };
    },
  } as DriverRoutingService;
  const app = express();
  registerDispatchDriverRoutes(
    app,
    { listDrivers: async () => [] } as SystemUserService,
    repository,
    routing,
    async (request) => ({
      user: request.header("authorization") === "Bearer driver-token" ? driver : administrator,
      cookies: {},
    }),
  );

  await withTestServer(app, async (origin) => {
    const adminResponse = await fetch(`${origin}/api/channel-sales/baguio/dispatches/${dispatchId}/map`, {
      headers: { Authorization: "Bearer admin-token" },
    });
    const driverResponse = await fetch(`${origin}/api/channel-sales/baguio/dispatches/${dispatchId}/map`, {
      headers: { Authorization: "Bearer driver-token" },
    });
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.headers.get("content-type"), "image/png");
    assert.equal(mappedOrderCount, 1);
    assert.equal(driverResponse.status, 403);
  });
});
