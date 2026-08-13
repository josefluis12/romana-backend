import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { ProductRepository } from "../src/repositories/products.js";
import { detectImageType, type ProductImageStorage } from "../src/services/product-images.js";
import type { AuthService } from "../src/supabase-auth.js";

const user = { id: "user-id", email: "staff@example.com" } as User;
const auth: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session: null, user: null }),
  getUser: async (token) => ({ error: null, user: token === "access-token" ? user : null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};
const products: ProductRepository = {
  list: async () => [],
  listPublic: async () => [],
  create: async () => { throw new Error("Not used in image tests."); },
  update: async () => { throw new Error("Not used in image tests."); },
  setActive: async () => { throw new Error("Not used in image tests."); },
};

async function withServer(storage: ProductImageStorage, run: (origin: string) => Promise<void>) {
  const server = createApp({ auth, products, productImages: storage }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

const cookies = "romana_access_token=access-token; romana_csrf=csrf-token";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("detects supported product image signatures", () => {
  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff])), "image/jpeg");
  assert.equal(detectImageType(Buffer.from("not an image")), null);
});

test("uploads an authenticated product image", async () => {
  let uploadedUserId = "";
  const storage: ProductImageStorage = {
    upload: async (_token, userId) => {
      uploadedUserId = userId;
      return "https://example.supabase.co/storage/v1/object/public/product-images/image.png";
    },
  };
  await withServer(storage, async (origin) => {
    const response = await fetch(`${origin}/api/product-images`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "image/png", "X-CSRF-Token": "csrf-token" },
      body: png,
    });
    assert.equal(response.status, 201);
    assert.equal(uploadedUserId, "user-id");
    assert.deepEqual(await response.json(), { url: "https://example.supabase.co/storage/v1/object/public/product-images/image.png" });
  });
});

test("rejects image content that does not match its declared type", async () => {
  const storage: ProductImageStorage = { upload: async () => "unused" };
  await withServer(storage, async (origin) => {
    const response = await fetch(`${origin}/api/product-images`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "image/jpeg", "X-CSRF-Token": "csrf-token" },
      body: png,
    });
    assert.equal(response.status, 400);
  });
});

test("requires CSRF protection for image uploads", async () => {
  const storage: ProductImageStorage = { upload: async () => "unused" };
  await withServer(storage, async (origin) => {
    const response = await fetch(`${origin}/api/product-images`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "image/png" },
      body: png,
    });
    assert.equal(response.status, 403);
  });
});
