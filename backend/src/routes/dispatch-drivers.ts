import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { ChannelSalesRepository } from "../repositories/channel-sales.js";
import type { SystemUserService } from "../services/system-users.js";
import { isDispatchDriver } from "../services/system-users.js";

interface DriverRouteSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<DriverRouteSession>;

export function registerDispatchDriverRoutes(
  app: Express,
  users: SystemUserService,
  channelSales: ChannelSalesRepository,
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
}
