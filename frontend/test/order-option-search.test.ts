import assert from "node:assert/strict";
import test from "node:test";
import { createVariantOptions, searchCustomers, searchVariants } from "../src/app/(dashboard)/baguio-sales/_lib/order-option-search.ts";
import type { BaguioClient } from "../src/types/channel-sale.ts";
import type { Product } from "../src/types/product.ts";

const customer = (id: string, name: string, referenceNumber: string, isActive = true): BaguioClient => ({
  id,
  name,
  referenceNumber,
  isActive,
  contactPerson: name === "North Shop" ? "Ana Reyes" : "",
  phone: name === "North Shop" ? "09171234567" : "",
  email: `${id}@example.com`,
  address: "Baguio City",
  createdAt: "2026-01-01T00:00:00.000Z",
});

const product: Product = {
  id: "product-1",
  slug: "cashew-butter",
  title: "Cashew Butter",
  category: "Spreads",
  bestSeller: false,
  isActive: true,
  ingredients: [],
  allergens: [],
  short: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  variants: [
    { id: "small", label: "250g", price: 320, image: "/small.png" },
    { id: "large", label: "500g", price: 590, image: "/large.png" },
  ],
};

test("searches active registered customers by identity and contact fields", () => {
  const customers = [customer("north", "North Shop", "BAG-001"), customer("south", "South Shop", "BAG-002"), customer("old", "Old Shop", "BAG-003", false)];
  assert.deepEqual(searchCustomers(customers, "ana").map(({ id }) => id), ["north"]);
  assert.deepEqual(searchCustomers(customers, "BAG-002").map(({ id }) => id), ["south"]);
  assert.deepEqual(searchCustomers(customers, "BAG-002", "north").map(({ id }) => id), ["north", "south"]);
  assert.equal(searchCustomers(customers, "old").length, 0);
});

test("searches product variants and retains the selected option", () => {
  const variants = createVariantOptions([product]);
  assert.deepEqual(searchVariants(variants, "500G", "small").map(({ id }) => id), ["small", "large"]);
  assert.deepEqual(searchVariants(variants, "spreads", "").map(({ id }) => id), ["small", "large"]);
});
