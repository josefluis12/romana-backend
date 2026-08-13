import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { createApp } from "../src/app.js";
import type { ProductRepository } from "../src/repositories/products.js";
import type { AuthService } from "../src/supabase-auth.js";
import type { Product, ProductInput } from "../src/types/product.js";

const user = { email: "staff@example.com" } as User;
const input: ProductInput = {
  slug: "cashew-butter",
  title: "Cashew Butter",
  category: "Spreads",
  bestSeller: true,
  ingredients: ["Roasted cashews", "Sugar", "Salt"],
  allergens: ["Contains cashews"],
  short: "Creamy cashew butter made from roasted cashews.",
  variants: [
    { label: "250g", price: 320, image: "/products/cashew-butter-250g.png" },
    { label: "500g", price: 590, image: "/products/cashew-butter-500g.png" },
  ],
};
const stored: Product = {
  ...input,
  id: "11111111-1111-4111-8111-111111111111",
  isActive: true,
  variants: input.variants.map((variant, index) => ({ ...variant, id: `variant-${index}` })),
  createdAt: "2026-08-13T00:00:00.000Z",
};

const authenticated: AuthService = {
  isConfigured: true,
  signIn: async () => ({ error: null, session: null, user: null }),
  getUser: async (token) => ({ error: null, user: token === "access-token" ? user : null }),
  refresh: async () => ({ error: null, session: null, user: null }),
  signOut: async () => undefined,
};

function repository(publicProducts: Product[] = [stored]): ProductRepository {
  return {
    list: async () => [stored],
    listPublic: async () => publicProducts,
    create: async (_token, product) => ({
      ...product,
      id: stored.id,
      isActive: true,
      variants: product.variants.map((variant, index) => ({ ...variant, id: `variant-${index}` })),
      createdAt: stored.createdAt,
    }),
    update: async (_token, id, product) => ({
      ...product,
      id,
      isActive: true,
      variants: product.variants.map((variant, index) => ({ ...variant, id: `variant-${index}` })),
      createdAt: stored.createdAt,
    }),
    setActive: async (_token, id, isActive) => ({ ...stored, id, isActive }),
  };
}

async function withServer(
  run: (origin: string) => Promise<void>,
  auth: AuthService = authenticated,
  products: ProductRepository = repository(),
) {
  const server = createApp({ auth, products }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

const cookies = "romana_access_token=access-token; romana_csrf=csrf-token";

test("lists products for an authenticated administrator", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`, { headers: { Cookie: cookies } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { products: [stored] });
  });
});

test("serves the active storefront catalog without authentication", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/storefront/products`);
    assert.equal(response.status, 200);
    const body = await response.json() as { products: Array<Record<string, unknown>> };
    assert.equal(body.products[0]?.slug, stored.slug);
    assert.equal(body.products[0]?.isActive, undefined);
    assert.deepEqual(body.products[0]?.variants, input.variants);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("excludes disabled products from the storefront catalog", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/storefront/products`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { products: [] });
  }, authenticated, repository([{ ...stored, isActive: false }]));
});

test("creates a validated product for an authenticated administrator", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { product: stored });
  });
});

test("rejects product creation without a valid CSRF token", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 403);
  });
});

test("rejects invalid product details", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, slug: "Not a valid slug" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Enter a valid lowercase product slug." });
  });
});

test("requires every product to have a priced size", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`, {
      method: "POST",
      headers: { Cookie: cookies, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, variants: [] }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Add at least one size with a valid price and image." });
  });
});

test("requires authentication before products can be accessed", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products`);
    assert.equal(response.status, 401);
  });
});

test("updates an existing product", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products/${stored.id}`, {
      method: "PUT",
      headers: { Cookie: cookies, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ ...input, title: "Updated Cashew Butter" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { product: Product };
    assert.equal(body.product.title, "Updated Cashew Butter");
  });
});

test("disables a product without deleting it", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/products/${stored.id}/status`, {
      method: "PATCH",
      headers: { Cookie: cookies, "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { product: Product };
    assert.equal(body.product.isActive, false);
  });
});
