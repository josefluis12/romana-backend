import type { BaguioSale } from "../types/channel-sales.js";

const MAX_STATIC_MAP_STOPS = 15;
const MAX_NAVIGATION_STOPS = 10;

interface DriverOrigin {
  latitude: number;
  longitude: number;
}

export interface DriverNavigationRoute {
  googleMapsUrl: string;
  optimizedOrderIds: string[];
  omittedStopCount: number;
}

export interface DriverRoutingService {
  readonly isConfigured: boolean;
  createStaticMap(orders: BaguioSale[]): Promise<{ bytes: ArrayBuffer; contentType: string }>;
  createNavigationRoute(origin: DriverOrigin, orders: BaguioSale[]): Promise<DriverNavigationRoute>;
}

export function createGoogleDriverRoutingService(apiKey: string): DriverRoutingService {
  return {
    isConfigured: Boolean(apiKey),
    async createStaticMap(orders) {
      assertConfigured(apiKey);
      const mapUrl = buildStaticMapUrl(apiKey, orders.slice(0, MAX_STATIC_MAP_STOPS));
      const response = await fetch(mapUrl);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) throw new Error("Static route map request failed.");
      return { bytes: await response.arrayBuffer(), contentType };
    },
    async createNavigationRoute(origin, orders) {
      assertConfigured(apiKey);
      if (!orders.length) throw new Error("This dispatch has no delivery stops.");
      const included = orders.slice(0, MAX_NAVIGATION_STOPS);
      const ordered = included.length === 1 ? included : await optimizeStops(apiKey, origin, included);
      return {
        googleMapsUrl: buildGoogleMapsUrl(origin, ordered),
        optimizedOrderIds: ordered.map((order) => order.id),
        omittedStopCount: Math.max(0, orders.length - included.length),
      };
    },
  };
}

async function optimizeStops(apiKey: string, origin: DriverOrigin, orders: BaguioSale[]): Promise<BaguioSale[]> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify({
      origin: waypointForOrigin(origin),
      destination: waypointForOrigin(origin),
      intermediates: orders.map((order) => ({ address: order.clientAddress })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
    }),
  });
  if (!response.ok) throw new Error("Route optimization request failed.");
  const value: unknown = await response.json();
  const indexes = readOptimizedIndexes(value, orders.length);
  return indexes.map((index) => orders[index]!);
}

function buildStaticMapUrl(apiKey: string, orders: BaguioSale[]): string {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "640x360");
  url.searchParams.set("scale", "2");
  url.searchParams.set("format", "png");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("key", apiKey);
  orders.forEach((order, index) => {
    const marker = `color:${markerColor(order.status)}|label:${markerLabel(index)}|${order.clientAddress}`;
    url.searchParams.append("markers", marker);
  });
  return url.toString();
}

function buildGoogleMapsUrl(origin: DriverOrigin, orders: BaguioSale[]): string {
  const url = new URL("https://www.google.com/maps/dir/");
  const destination = orders.at(-1);
  if (!destination) throw new Error("This dispatch has no delivery stops.");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", destination.clientAddress);
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  if (orders.length > 1) url.searchParams.set("waypoints", orders.slice(0, -1).map((order) => order.clientAddress).join("|"));
  return url.toString();
}

function readOptimizedIndexes(value: unknown, count: number): number[] {
  if (!isRecord(value) || !Array.isArray(value.routes) || !isRecord(value.routes[0])) throw new Error("Route optimization returned invalid data.");
  const indexes = value.routes[0].optimizedIntermediateWaypointIndex;
  if (!Array.isArray(indexes) || indexes.length !== count || !indexes.every((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < count)) {
    throw new Error("Route optimization returned invalid waypoint order.");
  }
  if (new Set(indexes).size !== count) throw new Error("Route optimization returned duplicate waypoints.");
  return indexes.map(Number);
}

function markerColor(status: string): string {
  if (status === "delivered" || status === "successful") return "0x2E7D32";
  if (status === "cancelled") return "0xC62828";
  return "0xF4A000";
}

function markerLabel(index: number): string {
  return index < 9 ? String(index + 1) : String.fromCharCode(65 + index - 9);
}

function waypointForOrigin(origin: DriverOrigin) {
  return { location: { latLng: origin } };
}

function assertConfigured(apiKey: string): void {
  if (!apiKey) throw new Error("Google driver routing is not configured.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
