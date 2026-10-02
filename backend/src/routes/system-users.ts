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

  app.get("/api/system-users/:userId", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    if (isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    const userId = request.params.userId;
    if (!userId || !isUuid(userId)) return response.status(400).json({ error: "Choose a valid system user." });
    try {
      const user = await users.getProfile(userId);
      return user
        ? response.json({ user })
        : response.status(404).json({ error: "The system user was not found." });
    } catch {
      return response.status(503).json({ error: "The user profile is unavailable." });
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
