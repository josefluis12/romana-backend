import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { ChannelSalesRepository } from "../repositories/channel-sales.js";
import { validateDispatchDriverInput } from "../schemas/channel-sales.js";
import type { DispatchDriverService } from "../services/dispatch-drivers.js";
import { isDispatchDriver } from "../services/dispatch-drivers.js";
import { CSRF_COOKIE, safeEqual } from "../security.js";

interface DriverRouteSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<DriverRouteSession>;

export function registerDispatchDriverRoutes(
  app: Express,
  drivers: DispatchDriverService,
  channelSales: ChannelSalesRepository,
  resolveSession: ResolveSession,
): void {
  app.get("/api/dispatch-drivers", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    try {
      return response.json({ drivers: await drivers.list() });
    } catch {
      return response.status(503).json({ error: "Driver accounts are unavailable." });
    }
  });

  app.post("/api/dispatch-drivers", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) return response.status(403).json({ error: "Forbidden" });
    const validation = validateDispatchDriverInput(request.body);
    if (!validation.driver) return response.status(400).json({ error: validation.error });
    try {
      return response.status(201).json({ driver: await drivers.create(validation.driver) });
    } catch {
      return response.status(503).json({ error: "The driver account could not be created." });
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
}
