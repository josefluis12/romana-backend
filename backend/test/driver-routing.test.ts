import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleDriverRoutingService, DRIVER_ROUTE_ORIGIN } from "../src/services/driver-routing.js";
import type { BaguioSale } from "../src/types/channel-sales.js";

test("uses Google's optimized stop order in the Maps navigation URL", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ routes: [{ optimizedIntermediateWaypointIndex: [1, 0, 2], polyline: { encodedPolyline: "route-path" } }] });
  };
  const orders = [order("one", "Address One"), order("two", "Address Two"), order("three", "Address Three")];
  const route = await createGoogleDriverRoutingService("test-key").createNavigationRoute(orders);
  const url = new URL(route.googleMapsUrl);
  assert.deepEqual(route.optimizedOrderIds, ["two", "one", "three"]);
  assert.equal(url.searchParams.get("origin"), DRIVER_ROUTE_ORIGIN);
  assert.equal(url.searchParams.get("destination"), "Address Three");
  assert.equal(url.searchParams.get("waypoints"), "Address Two|Address One");
  assert.deepEqual(requestBody, {
    origin: { address: DRIVER_ROUTE_ORIGIN },
    destination: { address: DRIVER_ROUTE_ORIGIN },
    intermediates: [{ address: "Address One" }, { address: "Address Two" }, { address: "Address Three" }],
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    optimizeWaypointOrder: true,
  });
});

test("colors static-map pins from each order status", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    if (String(input).includes("computeRoutes")) {
      return Response.json({ routes: [{ optimizedIntermediateWaypointIndex: [-1], polyline: { encodedPolyline: "route-path" } }] });
    }
    requestedUrl = String(input);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
  };
  await createGoogleDriverRoutingService("test-key").createStaticMap([
    order("pending", "Pending Address", "in_transit"),
    order("done", "Done Address", "delivered"),
    order("failed", "Failed Address", "cancelled"),
  ]);
  const markers = new URL(requestedUrl).searchParams.getAll("markers");
  assert.match(markers[0] || "", /0x1565C0/);
  assert.match(markers[1] || "", /0xF4A000/);
  assert.match(markers[2] || "", /0x2E7D32/);
  assert.match(markers[3] || "", /0xC62828/);
  assert.match(new URL(requestedUrl).searchParams.get("path") || "", /route-path/);
  assert.equal(new URL(requestedUrl).searchParams.get("center"), "Baguio City, Benguet");
  assert.equal(new URL(requestedUrl).searchParams.get("zoom"), "12");
});

test("does not navigate back to completed stops", async () => {
  const route = await createGoogleDriverRoutingService("test-key").createNavigationRoute(
    [order("done", "Done Address", "delivered"), order("pending", "Pending Address")],
  );
  assert.deepEqual(route.optimizedOrderIds, ["pending"]);
  assert.equal(new URL(route.googleMapsUrl).searchParams.get("destination"), "Pending Address");
});

function order(id: string, clientAddress: string, status = "in_transit"): BaguioSale {
  return { id, clientAddress, status } as BaguioSale;
}
