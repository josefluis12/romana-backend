import cors from "cors";
import express, { type CookieOptions, type Request, type Response } from "express";
import type { Session, User } from "@supabase/supabase-js";
import { config } from "./config.js";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  createAttemptLimiter,
  createCsrfToken,
  parseCookies,
  safeEqual,
} from "./security.js";
import { createSupabaseAuth, type AuthService } from "./supabase-auth.js";

interface AppDependencies {
  auth?: AuthService;
  adminEmails?: string[];
}

interface ResolvedSession {
  user: User | null;
  cookies: Record<string, string>;
}

export function createApp({
  auth = createSupabaseAuth({ url: config.supabaseUrl, key: config.supabaseKey }),
  adminEmails = config.adminEmails,
}: AppDependencies = {}) {
  const app = express();
  const limiter = createAttemptLimiter();
  const isAdministrator = (user: User | null): user is User =>
    adminEmails.includes((user?.email || "").toLowerCase());

  app.disable("x-powered-by");
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "10kb" }));
  app.use((_request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    next();
  });

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProduction,
    path: "/api",
  };

  function setSessionCookies(response: Response, session: Session): void {
    const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in;
    const ttlMs = Math.max(0, expiresAt * 1000 - Date.now());
    response.cookie(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: ttlMs });
    response.cookie(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }

  function clearSessionCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, cookieOptions);
    response.clearCookie(REFRESH_COOKIE, cookieOptions);
    response.clearCookie(CSRF_COOKIE, cookieOptions);
  }

  async function resolveSession(request: Request, response: Response): Promise<ResolvedSession> {
    const cookies = parseCookies(request.headers.cookie);
    const current = await auth.getUser(cookies[ACCESS_COOKIE]);
    if (isAdministrator(current.user)) return { user: current.user, cookies };

    const refreshed = await auth.refresh(cookies[REFRESH_COOKIE]);
    if (!refreshed.session || !isAdministrator(refreshed.user)) return { user: null, cookies };
    setSessionCookies(response, refreshed.session);
    return { user: refreshed.user, cookies };
  }

  app.get("/api/health", (_request, response) => response.json({
    status: "ok",
    auth: auth.isConfigured ? "configured" : "setup_required",
  }));

  app.get("/api/auth/session", async (request, response) => {
    const { user, cookies } = await resolveSession(request, response);
    if (!user) {
      clearSessionCookies(response);
      return response.status(401).json({ authenticated: false });
    }
    const csrfToken = cookies[CSRF_COOKIE] || createCsrfToken();
    if (!cookies[CSRF_COOKIE]) {
      response.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    return response.json({ authenticated: true, user: { email: user.email }, csrfToken });
  });

  app.post("/api/auth/login", async (request, response) => {
    const email = String(request.body.email || "").slice(0, 254).trim().toLowerCase();
    const password = String(request.body.password || "").slice(0, 512);
    const attemptKey = `${request.ip}:${email}`;

    if (!auth.isConfigured) {
      return response.status(503).json({ error: "Shop authentication is being configured." });
    }
    if (limiter.isLimited(attemptKey)) {
      return response.status(429).json({ error: "Too many sign-in attempts. Please try again in 15 minutes." });
    }

    const result = await auth.signIn(email, password);
    if (result.error || !result.session || !isAdministrator(result.user)) {
      limiter.recordFailure(attemptKey);
      if (result.session && result.user) {
        await auth.signOut(result.session.access_token, result.session.refresh_token);
      }
      return response.status(401).json({ error: "That email and password combination was not recognized." });
    }

    limiter.clear(attemptKey);
    const csrfToken = createCsrfToken();
    setSessionCookies(response, result.session);
    response.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    return response.json({ user: { email: result.user.email }, csrfToken });
  });

  app.post("/api/auth/logout", async (request, response) => {
    const cookies = parseCookies(request.headers.cookie);
    if (!safeEqual(request.body.csrfToken, cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    await auth.signOut(cookies[ACCESS_COOKIE], cookies[REFRESH_COOKIE]);
    clearSessionCookies(response);
    return response.status(204).send();
  });

  app.use("/api", (_request, response) => response.status(404).json({ error: "Not found" }));
  return app;
}
