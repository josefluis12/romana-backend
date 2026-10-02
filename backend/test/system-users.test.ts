import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { Session, User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { SystemUserService } from "../src/services/system-users.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { SystemUserProfile } from "../src/types/system-user.js";

const administrator = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com" } as User;
const session = { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user: administrator } as Session;
const profile: SystemUserProfile = {
  userId: "22222222-2222-4222-8222-222222222222",
  name: "Maria Santos",
  email: "maria@example.com",
  role: "administrator",
  createdAt: "2026-09-01T08:00:00.000Z",
  lastSignInAt: "2026-10-01T08:00:00.000Z",
  logs: [{ id: "event-1", category: "online_order", action: "processing", referenceNumber: "ORDER-001", createdAt: "2026-10-01T09:00:00.000Z" }],
};

const auth: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session, user: administrator }),
  getUser: async (token) => ({ error: null, user: token === "access-token" ? administrator : null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

function createUsers(found: SystemUserProfile | null = profile): SystemUserService {
  return {
    list: async () => [],
    listDrivers: async () => [],
    getProfile: async () => found,
    create: async () => profile,
  };
}

async function withServer(users: SystemUserService, run: (origin: string) => Promise<void>) {
  const server = createApp({ auth, systemUsers: users }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("returns a system user profile and activity logs to an administrator", async () => {
  await withServer(createUsers(), async (origin) => {
    const response = await fetch(`${origin}/api/system-users/${profile.userId}`, { headers: { Cookie: "romana_access_token=access-token" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: profile });
  });
});

test("rejects an invalid system user identifier", async () => {
  await withServer(createUsers(), async (origin) => {
    const response = await fetch(`${origin}/api/system-users/not-a-user`, { headers: { Cookie: "romana_access_token=access-token" } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Choose a valid system user." });
  });
});

test("returns not found for a missing system user", async () => {
  await withServer(createUsers(null), async (origin) => {
    const response = await fetch(`${origin}/api/system-users/${profile.userId}`, { headers: { Cookie: "romana_access_token=access-token" } });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "The system user was not found." });
  });
});
