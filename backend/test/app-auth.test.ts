import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { Session, User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { AuthService } from "../src/supabase-auth.js";

const authenticatedUser = { email: "staff@example.com" } as User;
const authenticatedSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  user: authenticatedUser,
} as Session;

function createAuthenticatedService(): AuthService {
  return {
    isConfigured: true,
    signIn: async () => ({ error: null, session: authenticatedSession, user: authenticatedUser }),
    getUser: async () => ({ error: null, user: null }),
    refresh: async () => ({ error: null, session: null, user: null }),
    signOut: async () => undefined,
  };
}

test("allows any user authenticated by the configured Supabase project", async (context) => {
  const server = createApp({ auth: createAuthenticatedService() }).listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));

  const port = (server.address() as AddressInfo).port;
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "staff@example.com", password: "valid-password" }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as { user: { email: string }; csrfToken: string };
  assert.equal(body.user.email, "staff@example.com");
  assert.match(body.csrfToken, /^[A-Za-z0-9_-]+$/);
  assert.match(response.headers.get("set-cookie") || "", /romana_access_token=/);
});
