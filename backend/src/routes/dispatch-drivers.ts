import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { ChannelSalesRepository } from "../repositories/channel-sales.js";
import type { SystemUserService } from "../services/system-users.js";
import { isDispatchDriver } from "../services/system-users.js";
import { getAuthenticatedUserName } from "../authenticated-user.js";
import { isUuid } from "../schemas/channel-sales.js";
import { validateDriverDeliveryProof } from "../schemas/driver-delivery.js";
import { validateDispatchReconciliation } from "../schemas/dispatch-reconciliation.js";
import type { DriverRoutingService } from "../services/driver-routing.js";

interface DriverRouteSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<DriverRouteSession>;

export function registerDispatchDriverRoutes(
  app: Express,
  users: SystemUserService,
  channelSales: ChannelSalesRepository,
  driverRouting: DriverRoutingService,
  resolveSession: ResolveSession,
): void {
  app.get("/api/dispatch-drivers", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    try {
      return response.json({ drivers: await users.listDrivers() });
    } catch {
      return response.status(503).json({ error: "Driver accounts are unavailable." });
    }
  });

  app.get("/api/driver/dispatches", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!isDispatchDriver(session.user)) return response.status(403).json({ error: "Driver access required." });
    try {
      return response.json({ dispatches: await channelSales.listBaguioDispatches(session.user.id) });
    } catch {
      return response.status(503).json({ error: "Assigned dispatches are unavailable." });
    }
  });

  app.get("/api/driver/dispatches/:dispatchId/map", async (request, response) => {
    const assignment = await resolveDriverAssignment(request, response, channelSales, resolveSession);
    if (!assignment) return;
    if (!driverRouting.isConfigured) return response.status(503).json({ error: "Driver maps have not been configured." });
    try {
      const map = await driverRouting.createStaticMap(assignment.dispatch.orders);
      response.set({ "Cache-Control": "private, max-age=300", "Content-Type": map.contentType });
      return response.send(Buffer.from(map.bytes));
    } catch {
      return response.status(503).json({ error: "The dispatch map is unavailable." });
    }
  });

  app.get("/api/channel-sales/baguio/dispatches/:dispatchId/map", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    const dispatchId = request.params.dispatchId;
    if (!dispatchId || !isUuid(dispatchId)) return response.status(400).json({ error: "Invalid dispatch identifier." });
    if (!driverRouting.isConfigured) return response.status(503).json({ error: "Driver maps have not been configured." });
    try {
      const dispatch = (await channelSales.listBaguioDispatches()).find((item) => item.id === dispatchId);
      if (!dispatch) return response.status(404).json({ error: "Dispatch not found." });
      const map = await driverRouting.createStaticMap(dispatch.orders);
      response.set({ "Cache-Control": "private, max-age=30", "Content-Type": map.contentType });
      return response.send(Buffer.from(map.bytes));
    } catch {
      return response.status(503).json({ error: "The dispatch route map is unavailable." });
    }
  });

  app.post("/api/driver/dispatches/:dispatchId/route", async (request, response) => {
    const assignment = await resolveDriverAssignment(request, response, channelSales, resolveSession);
    if (!assignment) return;
    if (!driverRouting.isConfigured) return response.status(503).json({ error: "Driver routing has not been configured." });
    try {
      return response.json(await driverRouting.createNavigationRoute(assignment.dispatch.orders));
    } catch {
      return response.status(503).json({ error: "The best route could not be calculated." });
    }
  });

  app.post("/api/driver/dispatches/:dispatchId/start", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!isDispatchDriver(session.user)) return response.status(403).json({ error: "Driver access required." });
    const dispatchId = request.params.dispatchId;
    if (!dispatchId || !isUuid(dispatchId)) {
      return response.status(400).json({ error: "Invalid dispatch identifier." });
    }
    try {
      const started = await channelSales.startDriverTrip(dispatchId, {
        userId: session.user.id,
        email: session.user.email ?? null,
        name: getAuthenticatedUserName(session.user),
      });
      if (!started) {
        return response.status(409).json({ error: "This trip is not ready to start. Refresh and try again." });
      }
      return response.json({ status: "in_transit" });
    } catch {
      return response.status(503).json({ error: "The trip could not be started." });
    }
  });

  app.post("/api/driver/orders/:orderId/deliver", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!isDispatchDriver(session.user)) return response.status(403).json({ error: "Driver access required." });
    const orderId = request.params.orderId;
    if (!orderId || !isUuid(orderId)) return response.status(400).json({ error: "Invalid order identifier." });
    const validation = validateDriverDeliveryProof(request.body);
    if (!validation.proof) return response.status(400).json({ error: validation.error });
    try {
      const delivered = await channelSales.completeDriverDelivery(orderId, validation.proof, {
        userId: session.user.id,
        email: session.user.email ?? null,
        name: getAuthenticatedUserName(session.user),
      });
      if (!delivered) {
        return response.status(409).json({ error: "This delivery is not pending on your assigned dispatch." });
      }
      return response.json({ status: "delivered" });
    } catch {
      return response.status(503).json({ error: "The delivery proof could not be saved." });
    }
  });

  app.post("/api/driver/dispatches/:dispatchId/reconcile", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (!isDispatchDriver(session.user)) return response.status(403).json({ error: "Driver access required." });
    const dispatchId = request.params.dispatchId;
    if (!dispatchId || !isUuid(dispatchId)) {
      return response.status(400).json({ error: "Invalid dispatch identifier." });
    }
    const validation = validateDispatchReconciliation(request.body);
    if (!validation.input) return response.status(400).json({ error: validation.error });
    try {
      const completed = await channelSales.reconcileDriverDispatch(dispatchId, validation.input, {
        userId: session.user.id,
        email: session.user.email ?? null,
        name: getAuthenticatedUserName(session.user),
      });
      if (!completed) {
        return response.status(409).json({ error: "This trip cannot be reconciled. Refresh the dispatch and review every order." });
      }
      return response.json({ status: "completed", reconciliation: "submitted" });
    } catch {
      return response.status(503).json({ error: "The trip reconciliation could not be submitted." });
    }
  });
}

async function resolveDriverAssignment(
  request: Request,
  response: Response,
  channelSales: ChannelSalesRepository,
  resolveSession: ResolveSession,
) {
  const session = await resolveSession(request, response);
  if (!session.user) {
    response.status(401).json({ error: "Authentication required." });
    return null;
  }
  if (!isDispatchDriver(session.user)) {
    response.status(403).json({ error: "Driver access required." });
    return null;
  }
  const dispatchId = request.params.dispatchId;
  if (typeof dispatchId !== "string" || !isUuid(dispatchId)) {
    response.status(400).json({ error: "Invalid dispatch identifier." });
    return null;
  }
  try {
    const dispatch = (await channelSales.listBaguioDispatches(session.user.id)).find((item) => item.id === dispatchId);
    if (!dispatch) {
      response.status(404).json({ error: "Assigned dispatch not found." });
      return null;
    }
    return { dispatch, user: session.user };
  } catch {
    response.status(503).json({ error: "Assigned dispatches are unavailable." });
    return null;
  }
}
