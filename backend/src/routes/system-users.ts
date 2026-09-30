import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { validateSystemUserInput } from "../schemas/system-user.js";
import type { SystemUserService } from "../services/system-users.js";
import { isDispatchDriver } from "../services/system-users.js";
import { CSRF_COOKIE, safeEqual } from "../security.js";

interface UserRouteSession {
  user: User | null;
  cookies: Record<string, string>;
}

type ResolveSession = (request: Request, response: Response) => Promise<UserRouteSession>;

export function registerSystemUserRoutes(app: Express, users: SystemUserService, resolveSession: ResolveSession): void {
  app.get("/api/system-users", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    try {
      return response.json({ users: await users.list() });
    } catch {
      return response.status(503).json({ error: "System users are unavailable." });
    }
  });

  app.post("/api/system-users", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) return response.status(403).json({ error: "Forbidden" });
    const validation = validateSystemUserInput(request.body);
    if (!validation.user) return response.status(400).json({ error: validation.error });
    try {
      return response.status(201).json({ user: await users.create(validation.user) });
    } catch {
      return response.status(503).json({ error: "The user account could not be created." });
    }
  });
}
