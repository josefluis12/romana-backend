import type { CookieOptions, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import type { AuthService } from "./supabase-auth.js";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, parseCookies } from "./security.js";

export interface ResolvedSession {
  user: User | null;
  cookies: Record<string, string>;
  accessToken?: string;
}

export function createSessionManager(auth: AuthService, cookieOptions: CookieOptions) {
  function set(response: Response, session: { access_token: string; refresh_token: string; expires_at?: number; expires_in: number }): void {
    const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in;
    const ttlMs = Math.max(0, expiresAt * 1000 - Date.now());
    response.cookie(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: ttlMs });
    response.cookie(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }

  function clear(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, cookieOptions);
    response.clearCookie(REFRESH_COOKIE, cookieOptions);
    response.clearCookie(CSRF_COOKIE, cookieOptions);
  }

  async function resolve(request: Request, response: Response): Promise<ResolvedSession> {
    const cookies = parseCookies(request.headers.cookie);
    const bearerToken = readBearerToken(request.header("authorization"));
    const accessToken = bearerToken || cookies[ACCESS_COOKIE];
    const current = await auth.getUser(accessToken);
    if (current.user) return { user: current.user, cookies, accessToken };
    if (bearerToken) return { user: null, cookies };

    const refreshed = await auth.refresh(cookies[REFRESH_COOKIE]);
    if (!refreshed.session || !refreshed.user) return { user: null, cookies };
    set(response, refreshed.session);
    return { user: refreshed.user, cookies, accessToken: refreshed.session.access_token };
  }

  return { clear, resolve, set };
}

function readBearerToken(value: string | undefined): string | undefined {
  const match = value?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1];
}
