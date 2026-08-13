import type { ProductInput, ProductVariantInput } from "../types/product.js";

interface ValidationResult {
  product?: ProductInput;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, field: string, maxLength: number): string | null {
  const value = record[field];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function readStringList(record: Record<string, unknown>, field: string): string[] | null {
  const value = record[field];
  if (!Array.isArray(value) || value.length > 30) return null;
  const items = value.map((item) => typeof item === "string" ? item.trim() : "");
  return items.every((item) => item.length > 0 && item.length <= 200) ? items : null;
}

function readVariants(record: Record<string, unknown>): ProductVariantInput[] | null {
  if (!Array.isArray(record.variants) || record.variants.length < 1 || record.variants.length > 20) return null;
  const variants: ProductVariantInput[] = [];
  for (const value of record.variants) {
    if (!isRecord(value)) return null;
    const label = readString(value, "label", 80);
    const price = value.price;
    const image = readString(value, "image", 500);
    if (!label || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 9_999_999.99 || Math.round(price * 100) / 100 !== price || !image) return null;
    variants.push({ label, price, image });
  }
  return variants;
}

export function validateProductInput(value: unknown): ValidationResult {
  if (!isRecord(value)) return { error: "Product details are required." };
  const slug = readString(value, "slug", 80);
  const title = readString(value, "title", 120);
  const category = readString(value, "category", 80);
  const ingredients = readStringList(value, "ingredients");
  const allergens = readStringList(value, "allergens");
  const short = readString(value, "short", 800);
  const variants = readVariants(value);

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Enter a valid lowercase product slug." };
  if (!title) return { error: "Enter a product title." };
  if (!category) return { error: "Enter a product category." };
  if (!ingredients) return { error: "Ingredients must be a list of short, non-empty entries." };
  if (!allergens) return { error: "Allergens must be a list of short, non-empty entries." };
  if (!short) return { error: "Enter a short product description." };
  if (!variants) return { error: "Add at least one size with a valid price and image." };
  if (typeof value.bestSeller !== "boolean") return { error: "Bestseller must be true or false." };

  return {
    product: { slug, title, category, ingredients, allergens, short, variants, bestSeller: value.bestSeller },
  };
}
