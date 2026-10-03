import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { ChannelSalesRepository } from "../repositories/channel-sales.js";
import { isUuid, readBaguioDispatchAction, readBaguioSaleAction, validateBaguioClientInput, validateBaguioDispatchInput, validateBaguioSaleInput, validateBaguioSaleUpdateInput, validateCustomerAddressInput } from "../schemas/channel-sales.js";
import { CSRF_COOKIE, safeEqual } from "../security.js";
import { getAuthenticatedUserName } from "../authenticated-user.js";

interface ChannelSalesSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<ChannelSalesSession>;

export function registerChannelSalesRoutes(
  app: Express,
  channelSales: ChannelSalesRepository,
  resolveSession: ResolveSession,
): void {
  app.get("/api/channel-sales/baguio", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    try {
      return response.json({ sales: await channelSales.listBaguioSales() });
    } catch {
      return response.status(503).json({ error: "Baguio sales are unavailable." });
    }
  });

  app.get("/api/inventory/vehicles", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    try {
      return response.json({ vehicles: await channelSales.listVans() });
    } catch {
      return response.status(503).json({ error: "Vehicle inventory locations are unavailable." });
    }
  });

  app.get("/api/channel-sales/baguio/dispatches", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    try {
      return response.json({ dispatches: await channelSales.listBaguioDispatches() });
    } catch {
      return response.status(503).json({ error: "Baguio dispatches are unavailable." });
    }
  });

  app.post("/api/channel-sales/baguio/dispatches", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const validation = validateBaguioDispatchInput(request.body);
    if (!validation.dispatch) return response.status(400).json({ error: validation.error });
    try {
      const id = await channelSales.createBaguioDispatch(validation.dispatch, actorFor(session.user));
      return response.status(201).json({ id });
    } catch {
      return response.status(503).json({ error: "The dispatch could not be created." });
    }
  });

  app.post("/api/channel-sales/baguio/dispatches/:dispatchId/:action", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const id = request.params.dispatchId;
    const action = readBaguioDispatchAction(request.params.action || "");
    if (!id || !isUuid(id)) return response.status(400).json({ error: "Invalid dispatch identifier." });
    if (!action) return response.status(404).json({ error: "Unknown dispatch action." });
    try {
      const changed = await channelSales.advanceBaguioDispatch(id, action, actorFor(session.user));
      if (!changed) return response.status(409).json({ error: "Load every order before starting this dispatch." });
      return response.json({ status: action === "start" ? "ready_for_departure" : "completed" });
    } catch {
      return response.status(503).json({ error: "The dispatch could not be updated." });
    }
  });

  app.get("/api/customers/directory/baguio", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const offset = readOffset(request.query.offset);
    if (offset === null) return response.status(400).json({ error: "Invalid client offset." });
    try {
      const limit = 100;
      const customers = await channelSales.listBaguioClients(limit, offset);
      return response.json({ customers, nextOffset: customers.length === limit ? offset + limit : null });
    } catch {
      return response.status(503).json({ error: "The Baguio client directory is unavailable." });
    }
  });

  app.get("/api/customers/directory/online", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const offset = readOffset(request.query.offset);
    if (offset === null) return response.status(400).json({ error: "Invalid customer offset." });
    try {
      const limit = 100;
      const customers = await channelSales.listOnlineClients(limit, offset);
      return response.json({ customers, nextOffset: customers.length === limit ? offset + limit : null });
    } catch {
      return response.status(503).json({ error: "The online customer directory is unavailable." });
    }
  });

  app.get("/api/customers/directory", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const offset = readOffset(request.query.offset);
    if (offset === null) return response.status(400).json({ error: "Invalid customer offset." });
    try {
      const limit = 100;
      const customers = await channelSales.listCustomers(limit, offset);
      return response.json({ customers, nextOffset: customers.length === limit ? offset + limit : null });
    } catch {
      return response.status(503).json({ error: "The customer directory is unavailable." });
    }
  });

  app.post("/api/customers", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const validation = validateBaguioClientInput(request.body);
    if (!validation.client) return response.status(400).json({ error: validation.error });
    try {
      const client = await channelSales.createBaguioClient(validation.client, actorFor(session.user));
      return response.status(201).json({ client });
    } catch {
      return response.status(503).json({ error: "The Baguio client could not be registered." });
    }
  });

  app.post("/api/customers/:customerId/addresses", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const customerId = request.params.customerId;
    if (!customerId || !isUuid(customerId)) return response.status(400).json({ error: "Invalid customer identifier." });
    const validation = validateCustomerAddressInput(request.body);
    if (!validation.address) return response.status(400).json({ error: validation.error });
    try {
      const address = await channelSales.createCustomerAddress(customerId, validation.address, actorFor(session.user));
      return response.status(201).json({ address });
    } catch {
      return response.status(503).json({ error: "The customer address could not be saved." });
    }
  });

  app.post("/api/channel-sales/baguio", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const validation = validateBaguioSaleInput(request.body);
    if (!validation.sale) return response.status(400).json({ error: validation.error });
    try {
      const id = await channelSales.createBaguioSale(validation.sale, actorFor(session.user));
      return response.status(201).json({ id });
    } catch {
      return response.status(503).json({ error: "The Baguio order could not be created." });
    }
  });

  app.put("/api/channel-sales/baguio/:saleId", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const saleId = request.params.saleId;
    if (!saleId || !isUuid(saleId)) return response.status(400).json({ error: "Invalid Baguio order identifier." });
    const validation = validateBaguioSaleUpdateInput(request.body);
    if (!validation.update) return response.status(400).json({ error: validation.error });
    try {
      const changed = await channelSales.updateBaguioSale(saleId, validation.update, actorFor(session.user));
      if (!changed) return response.status(409).json({ error: "Delivered, completed, and cancelled orders cannot be changed." });
      return response.json({ updated: true });
    } catch {
      return response.status(503).json({ error: "The Baguio order could not be updated." });
    }
  });

  app.post("/api/channel-sales/baguio/:saleId/:action", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!hasValidCsrf(request, session.cookies)) return response.status(403).json({ error: "Forbidden" });
    const saleId = request.params.saleId;
    const action = readBaguioSaleAction(request.params.action || "");
    if (!saleId || !isUuid(saleId)) return response.status(400).json({ error: "Invalid Baguio order identifier." });
    if (!action) return response.status(404).json({ error: "Unknown Baguio order action." });
    try {
      const changed = await channelSales.advanceBaguioSale(saleId, action, actorFor(session.user));
      if (!changed) return response.status(409).json({ error: "The order cannot perform that action from its current status." });
      return response.json({ status: nextStatus(action) });
    } catch {
      return response.status(503).json({ error: "The Baguio order could not be updated." });
    }
  });
}

function hasValidCsrf(request: Request, cookies: Record<string, string>): boolean {
  return safeEqual(request.header("x-csrf-token"), cookies[CSRF_COOKIE]);
}

function actorFor(user: User) {
  return { userId: user.id, email: user.email ?? null, name: getAuthenticatedUserName(user) };
}

function nextStatus(action: string): string {
  const statuses: Record<string, string> = {
    submit: "pending_approval",
    approve: "approved",
    load: "loaded",
    deliver: "delivered",
    complete: "successful",
  };
  return statuses[action] || "unknown";
}

function readOffset(value: unknown): number | null {
  if (value === undefined) return 0;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset <= 100_000 ? offset : null;
}
