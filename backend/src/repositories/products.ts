import { validateProductInput } from "../schemas/product.js";
import type { Product, ProductInput } from "../types/product.js";

interface ProductVariantRow {
  id: string;
  label: string;
  price: number | string;
  image: string;
  sort_order: number;
}

interface ProductRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  best_seller: boolean;
  is_active: boolean;
  ingredients: string[];
  allergens: string[];
  short: string;
  product_variants: ProductVariantRow[];
  created_at: string;
}

export interface ProductRepository {
  list(accessToken: string): Promise<Product[]>;
  listPublic(): Promise<Product[]>;
  create(accessToken: string, product: ProductInput): Promise<Product>;
  update(accessToken: string, id: string, product: ProductInput): Promise<Product>;
  setActive(accessToken: string, id: string, isActive: boolean): Promise<Product>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductRow(value: unknown): value is ProductRow {
  if (!isRecord(value) || !Array.isArray(value.product_variants)) return false;
  const variants = value.product_variants;
  if (!variants.every((variant) => isRecord(variant) && typeof variant.id === "string" && typeof variant.sort_order === "number")) return false;
  const validation = validateProductInput({
    slug: value.slug,
    title: value.title,
    category: value.category,
    bestSeller: value.best_seller,
    ingredients: value.ingredients,
    allergens: value.allergens,
    short: value.short,
    variants: variants.map((variant) => ({
      label: variant.label,
      price: Number(variant.price),
      image: variant.image,
    })),
  });
  return Boolean(validation.product && typeof value.id === "string" && typeof value.is_active === "boolean" && typeof value.created_at === "string");
}

function toProduct(row: unknown): Product {
  if (!isProductRow(row)) throw new Error("Product storage returned invalid product data.");
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    bestSeller: row.best_seller,
    isActive: row.is_active,
    ingredients: row.ingredients,
    allergens: row.allergens,
    short: row.short,
    variants: [...row.product_variants]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((variant) => ({ id: variant.id, label: variant.label, price: Number(variant.price), image: variant.image })),
    createdAt: row.created_at,
  };
}

export function createSupabaseProductRepository(url: string, key: string): ProductRepository {
  const headers = (accessToken?: string) => ({
    apikey: key,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    "Content-Type": "application/json",
  });

  async function find(accessToken: string, id?: string, activeOnly = false): Promise<Product[]> {
    if (!url || !key) throw new Error("Product storage is not configured.");
    const select = "select=id,slug,title,category,best_seller,is_active,ingredients,allergens,short,created_at,product_variants(id,label,price,image,sort_order)";
    const filter = id ? `&id=eq.${encodeURIComponent(id)}` : `${activeOnly ? "&is_active=eq.true" : ""}&order=created_at.desc`;
    const response = await fetch(`${url}/rest/v1/products?${select}${filter}`, { headers: headers(accessToken) });
    if (!response.ok) throw new Error("Product storage request failed.");
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error("Product storage returned an invalid response.");
    return value.map(toProduct);
  }

  async function save(accessToken: string, product: ProductInput, id?: string): Promise<Product> {
    if (!url || !key) throw new Error("Product storage is not configured.");
    const response = await fetch(`${url}/rest/v1/rpc/${id ? "update_product_with_variants" : "create_product_with_variants"}`, {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({
        ...(id ? { product_id: id } : {}),
        product_slug: product.slug,
        product_title: product.title,
        product_category: product.category,
        product_best_seller: product.bestSeller,
        product_ingredients: product.ingredients,
        product_allergens: product.allergens,
        product_short: product.short,
        product_variant_data: product.variants,
      }),
    });
    if (!response.ok) throw new Error("Product storage request failed.");
    const resultId: unknown = await response.json();
    if (typeof resultId !== "string") throw new Error("Product storage returned an invalid product identifier.");
    const saved = (await find(accessToken, resultId))[0];
    if (!saved) throw new Error("Product storage did not return the saved product.");
    return saved;
  }

  return {
    list: (accessToken) => find(accessToken),
    listPublic: () => find("", undefined, true),
    create: (accessToken, product) => save(accessToken, product),
    update: (accessToken, id, product) => save(accessToken, product, id),
    async setActive(accessToken, id, isActive) {
      const response = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { ...headers(accessToken), Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Product storage request failed.");
      const updated = (await find(accessToken, id))[0];
      if (!updated) throw new Error("Product storage did not return the updated product.");
      return updated;
    },
  };
}
