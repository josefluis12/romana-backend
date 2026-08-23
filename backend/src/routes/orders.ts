import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { OrderRepository } from "../repositories/orders.js";
import { CSRF_COOKIE, safeEqual } from "../security.js";
import type { MayaCheckoutService } from "../services/maya-checkout.js";
import { validateShipmentInput } from "../schemas/order.js";

interface OrderSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<OrderSession>;

export function registerOrderRoutes(app: Express, orders: OrderRepository, maya: MayaCheckoutService, resolveSession: ResolveSession): void {
  app.get("/api/orders", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    try {
      return response.json({ orders: await orders.list() });
    } catch {
      return response.status(503).json({ error: "Orders are unavailable." });
    }
  });

  app.get("/api/customers/:customerId/orders", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const customerId = request.params.customerId;
    if (!customerId || !isUuid(customerId)) return response.status(400).json({ error: "Invalid customer identifier." });
    const offset = readOffset(request.query.offset);
    if (offset === null) return response.status(400).json({ error: "Invalid order offset." });
    try {
      const limit = 100;
      const customerOrders = await orders.listByCustomer(customerId, limit, offset);
      return response.json({
        orders: customerOrders,
        nextOffset: customerOrders.length === limit ? offset + limit : null,
      });
    } catch {
      return response.status(503).json({ error: "Customer orders are unavailable." });
    }
  });

  app.post("/api/orders/:orderId/start-preparing", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    const orderId = request.params.orderId;
    if (!orderId || !isUuid(orderId)) return response.status(400).json({ error: "Invalid order identifier." });
    try {
      const started = await orders.startPreparing(orderId, {
        userId: session.user.id,
        email: session.user.email ?? null,
      });
      if (!started) return response.status(409).json({ error: "Only paid orders can start preparation." });
      return response.json({ status: "processing" });
    } catch {
      return response.status(503).json({ error: "Order preparation could not be started." });
    }
  });

  app.post("/api/orders/:orderId/ship", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    const orderId = request.params.orderId;
    if (!orderId || !isUuid(orderId)) return response.status(400).json({ error: "Invalid order identifier." });
    const validation = validateShipmentInput(request.body);
    if (!validation.shipment) return response.status(400).json({ error: validation.error });
    try {
      const shipped = await orders.ship(orderId, validation.shipment, {
        userId: session.user.id,
        email: session.user.email ?? null,
      });
      if (!shipped) return response.status(409).json({ error: "Only processing orders can be marked as shipped." });
      return response.json({ status: "shipped" });
    } catch {
      return response.status(503).json({ error: "The order could not be marked as shipped." });
    }
  });

  app.post("/api/orders/reconcile", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    try {
      const paymentIds = await orders.listPendingPaymentIds();
      let completed = 0;
      for (const paymentId of paymentIds) {
        if (await maya.getPaymentStatus(paymentId) !== "PAYMENT_SUCCESS") continue;
        if (await orders.completePaidCheckout(paymentId)) completed += 1;
      }
      return response.json({ checked: paymentIds.length, completed });
    } catch {
      return response.status(503).json({ error: "Pending payments could not be synchronized." });
    }
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readOffset(value: unknown): number | null {
  if (value === undefined) return 0;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset <= 100_000 ? offset : null;
}
