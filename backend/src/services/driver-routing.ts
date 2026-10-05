import type { BaguioSale } from "../types/channel-sales.js";

const MAX_STATIC_MAP_STOPS = 15;
const MAX_NAVIGATION_STOPS = 10;
const DRIVER_MAP_CENTER = "Baguio City, Benguet";
const DRIVER_MAP_ZOOM = 12;
export const DRIVER_ROUTE_ORIGIN = "744 De Vera St, Mangaldan, Pangasinan";

export interface DriverNavigationRoute {
  googleMapsUrl: string;
  optimizedOrderIds: string[];
  omittedStopCount: number;
}

export interface DriverRoutingService {
  readonly isConfigured: boolean;
  createStaticMap(orders: BaguioSale[]): Promise<{ bytes: ArrayBuffer; contentType: string }>;
  createNavigationRoute(orders: BaguioSale[]): Promise<DriverNavigationRoute>;
}

export function createGoogleDriverRoutingService(apiKey: string): DriverRoutingService {
  return {
    isConfigured: Boolean(apiKey),
    async createStaticMap(orders) {
      assertConfigured(apiKey);
      const visibleOrders = [
        ...orders.filter(isPendingOrder),
        ...orders.filter((order) => !isPendingOrder(order)),
      ].slice(0, MAX_STATIC_MAP_STOPS);
      const pendingOrders = visibleOrders.filter(isPendingOrder);
      const route = pendingOrders.length ? await optimizeStops(apiKey, pendingOrders) : null;
      const orderedOrders = route
        ? [...route.orders, ...visibleOrders.filter((order) => !isPendingOrder(order))]
        : visibleOrders;
      const mapUrl = buildStaticMapUrl(apiKey, orderedOrders, route?.encodedPolyline);
      const response = await fetch(mapUrl);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) throw new Error("Static route map request failed.");
      return { bytes: await response.arrayBuffer(), contentType };
    },
    async createNavigationRoute(orders) {
      assertConfigured(apiKey);
      const pendingOrders = orders.filter(isPendingOrder);
      if (!pendingOrders.length) throw new Error("This dispatch has no pending delivery stops.");
      const included = pendingOrders.slice(0, MAX_NAVIGATION_STOPS);
      const ordered = included.length === 1 ? included : (await optimizeStops(apiKey, included)).orders;
      return {
        googleMapsUrl: buildGoogleMapsUrl(ordered),
        optimizedOrderIds: ordered.map((order) => order.id),
        omittedStopCount: Math.max(0, pendingOrders.length - included.length),
      };
    },
  };
}

async function optimizeStops(apiKey: string, orders: BaguioSale[]): Promise<{ orders: BaguioSale[]; encodedPolyline: string }> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { address: DRIVER_ROUTE_ORIGIN },
      destination: { address: DRIVER_ROUTE_ORIGIN },
      intermediates: orders.map((order) => ({ address: order.clientAddress })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
    }),
  });
  if (!response.ok) throw new Error("Route optimization request failed.");
  const value: unknown = await response.json();
  const route = readRoute(value, orders.length);
  return {
    orders: route.indexes.map((index) => orders[index]!),
    encodedPolyline: route.encodedPolyline,
  };
}

function buildStaticMapUrl(apiKey: string, orders: BaguioSale[], encodedPolyline?: string): string {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "640x360");
  url.searchParams.set("scale", "2");
  url.searchParams.set("format", "png");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("center", DRIVER_MAP_CENTER);
  url.searchParams.set("zoom", String(DRIVER_MAP_ZOOM));
  url.searchParams.set("key", apiKey);
  url.searchParams.append("markers", `color:0x1565C0|label:D|${DRIVER_ROUTE_ORIGIN}`);
  if (encodedPolyline) url.searchParams.append("path", `color:0x1565C0|weight:5|enc:${encodedPolyline}`);
  orders.forEach((order, index) => {
    const marker = `color:${markerColor(order.status)}|label:${markerLabel(index)}|${order.clientAddress}`;
    url.searchParams.append("markers", marker);
  });
  return url.toString();
}

function buildGoogleMapsUrl(orders: BaguioSale[]): string {
  const url = new URL("https://www.google.com/maps/dir/");
  const destination = orders.at(-1);
  if (!destination) throw new Error("This dispatch has no delivery stops.");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", DRIVER_ROUTE_ORIGIN);
  url.searchParams.set("destination", destination.clientAddress);
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  if (orders.length > 1) url.searchParams.set("waypoints", orders.slice(0, -1).map((order) => order.clientAddress).join("|"));
  return url.toString();
}

function readRoute(value: unknown, count: number): { indexes: number[]; encodedPolyline: string } {
  if (!isRecord(value) || !Array.isArray(value.routes) || !isRecord(value.routes[0])) throw new Error("Route optimization returned invalid data.");
  const selectedRoute = value.routes[0];
  const returnedIndexes = selectedRoute.optimizedIntermediateWaypointIndex;
  const indexes = count === 1 && Array.isArray(returnedIndexes) && returnedIndexes.length === 1 && returnedIndexes[0] === -1
    ? [0]
    : returnedIndexes;
  if (!Array.isArray(indexes) || indexes.length !== count || !indexes.every((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < count)) {
    throw new Error("Route optimization returned invalid waypoint order.");
  }
  if (new Set(indexes).size !== count) throw new Error("Route optimization returned duplicate waypoints.");
  if (!isRecord(selectedRoute.polyline) || typeof selectedRoute.polyline.encodedPolyline !== "string") {
    throw new Error("Route optimization returned an invalid route path.");
  }
  return { indexes: indexes.map(Number), encodedPolyline: selectedRoute.polyline.encodedPolyline };
}

function markerColor(status: string): string {
  if (status === "delivered" || status === "successful") return "0x2E7D32";
  if (status === "cancelled") return "0xC62828";
  return "0xF4A000";
}

function markerLabel(index: number): string {
  return index < 9 ? String(index + 1) : String.fromCharCode(65 + index - 9);
}

function isPendingOrder(order: BaguioSale): boolean {
  return !["delivered", "successful", "cancelled"].includes(order.status);
}

function assertConfigured(apiKey: string): void {
  if (!apiKey) throw new Error("Google driver routing is not configured.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
