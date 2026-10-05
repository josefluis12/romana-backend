import type { Express, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { createAttemptLimiter } from "../security.js";
import { createGoogleCustomerPlacesService } from "../services/customer-places.js";

interface LocationSession { user: User | null }
type ResolveSession = (request: Request, response: Response) => Promise<LocationSession>;

export function registerCustomerLocationRoutes(app: Express, resolveSession: ResolveSession, apiKey: string): void {
  const places = createGoogleCustomerPlacesService(apiKey);
  const limiter = createAttemptLimiter({ limit: 120, windowMs: 60_000 });

  app.get("/api/customer-locations/autocomplete", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const input = readText(request.query.input, 200);
    const sessionToken = readToken(request.query.sessionToken);
    if (!input || input.length < 3 || !sessionToken) return response.status(400).json({ error: "Enter at least three characters to search addresses." });
    if (!places.isConfigured) return response.status(503).json({ error: "Google address search has not been configured." });
    const key = `${session.user.id}:${request.ip}`;
    if (limiter.isLimited(key)) return response.status(429).json({ error: "Too many address searches. Try again shortly." });
    limiter.recordFailure(key);
    try {
      return response.json({ predictions: await places.autocomplete(input, sessionToken) });
    } catch {
      return response.status(503).json({ error: "Address suggestions are unavailable." });
    }
  });

  app.get("/api/customer-locations/places/:placeId", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user) return response.status(401).json({ error: "Authentication required." });
    const placeId = readText(request.params.placeId, 255);
    const sessionToken = readToken(request.query.sessionToken);
    if (!placeId || !sessionToken) return response.status(400).json({ error: "Choose a valid Google address." });
    if (!places.isConfigured) return response.status(503).json({ error: "Google address search has not been configured." });
    try {
      return response.json({ place: await places.getPlace(placeId, sessionToken) });
    } catch {
      return response.status(503).json({ error: "The selected address could not be loaded." });
    }
  });
}

function readText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximum ? text : null;
}

function readToken(value: unknown): string | null {
  const token = readText(value, 36);
  return token && /^[0-9a-z_-]+$/i.test(token) ? token : null;
}
