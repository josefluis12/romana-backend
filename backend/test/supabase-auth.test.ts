import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseAuth } from "../src/supabase-auth.js";

test("reports an unconfigured Supabase connection without creating a client", async () => {
  const auth = createSupabaseAuth({ url: "", key: "", clientFactory: () => assert.fail("should not create client") });
  assert.equal(auth.isConfigured, false);
  assert.equal((await auth.signIn("admin@romana.ph", "secret")).session, null);
});

test("signs in through Supabase Auth", async () => {
  const expected = { access_token: "access", refresh_token: "refresh" };
  const auth = createSupabaseAuth({
    url: "https://example.supabase.co",
    key: "publishable-key",
    clientFactory: () => ({
      auth: {
        signInWithPassword: async (credentials: { email: string; password: string }) => {
          assert.deepEqual(credentials, { email: "admin@romana.ph", password: "secret" });
          return { data: { session: expected, user: { email: credentials.email } }, error: null };
        },
      },
    }) as never,
  });
  assert.equal((await auth.signIn("admin@romana.ph", "secret")).session, expected);
});
