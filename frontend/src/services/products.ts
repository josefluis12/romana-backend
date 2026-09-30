import type { Product, ProductInput } from "../types/product";

interface ProductsResponse {
  products: Product[];
  error?: string;
}

interface ProductResponse {
  product: Product;
  error?: string;
}

interface ImageResponse {
  url?: string;
  error?: string;
}

interface SessionResponse {
  authenticated: boolean;
  csrfToken?: string;
}

let tokenSource = "";
let currentCsrfToken = "";

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export async function listProducts(): Promise<Product[]> {
  const response = await fetch("/api/products", { credentials: "include" });
  const result = await readJson<ProductsResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load products.");
  return result.products;
}

export async function createProduct(product: ProductInput, csrfToken: string): Promise<Product> {
  const response = await fetchWithCsrf("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  }, csrfToken);
  const result = await readJson<ProductResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to create the product.");
  return result.product;
}

export async function updateProduct(id: string, product: ProductInput, csrfToken: string): Promise<Product> {
  return mutateProduct(`/api/products/${id}`, "PUT", product, csrfToken);
}

export async function setProductActive(id: string, isActive: boolean, csrfToken: string): Promise<Product> {
  return mutateProduct(`/api/products/${id}/status`, "PATCH", { isActive }, csrfToken);
}

async function mutateProduct(path: string, method: "PUT" | "PATCH", body: unknown, csrfToken: string): Promise<Product> {
  const response = await fetchWithCsrf(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, csrfToken);
  const result = await readJson<ProductResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to update the product.");
  return result.product;
}

export async function uploadProductImage(image: File, csrfToken: string): Promise<string> {
  const response = await fetchWithCsrf("/api/product-images", {
    method: "POST",
    headers: { "Content-Type": image.type },
    body: image,
  }, csrfToken);
  const result = await readJson<ImageResponse>(response);
  if (!response.ok || !result.url) throw new Error(result.error || "Unable to upload the product image.");
  return result.url;
}

export async function fetchWithCsrf(path: string, init: RequestInit, suppliedToken: string): Promise<Response> {
  if (tokenSource !== suppliedToken) {
    tokenSource = suppliedToken;
    currentCsrfToken = suppliedToken;
  }
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set("X-CSRF-Token", currentCsrfToken);
    return fetch(path, { ...init, credentials: "include", headers });
  };
  const response = await send();
  if (response.status !== 403) return response;

  const sessionResponse = await fetch("/api/auth/session", { credentials: "include" });
  if (!sessionResponse.ok) throw new Error("Your session expired. Sign in again and retry.");
  const session = await readJson<SessionResponse>(sessionResponse);
  if (!session.authenticated || !session.csrfToken) throw new Error("Your session expired. Sign in again and retry.");
  currentCsrfToken = session.csrfToken;
  return send();
}
