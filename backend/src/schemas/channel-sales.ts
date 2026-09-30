import type { BaguioClientInput, BaguioDispatchAction, BaguioDispatchInput, BaguioSaleAction, BaguioSaleInput, BaguioSaleUpdateInput } from "../types/channel-sales.js";
import type { ShippingAddress } from "../types/order.js";

interface ValidationResult {
  sale?: BaguioSaleInput;
  error?: string;
}

export function validateBaguioSaleInput(value: unknown): ValidationResult {
  if (!isRecord(value)) return { error: "Enter the Baguio order details." };
  const deliveryNotes = readText(value.deliveryNotes, 500, true);
  if (typeof value.customerId !== "string" || !isUuid(value.customerId)) return { error: "Choose a registered Baguio customer." };
  if (deliveryNotes === null) return { error: "Delivery notes must be 500 characters or fewer." };
  if (typeof value.dispatchId !== "string" || !isUuid(value.dispatchId)) {
    return { error: "Choose an open dispatch." };
  }
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) {
    return { error: "Add between 1 and 50 products." };
  }
  const items = value.items.map(readItem);
  if (items.some((item) => item === null)) return { error: "Each product requires a valid quantity and price." };
  const variantIds = items.flatMap((item) => item ? [item.productVariantId] : []);
  if (new Set(variantIds).size !== variantIds.length) return { error: "Add each product variant only once." };
  return {
    sale: {
      customerId: value.customerId,
      dispatchId: value.dispatchId,
      deliveryNotes,
      items: items.filter((item) => item !== null),
    },
  };
}

export function validateBaguioSaleUpdateInput(value: unknown): { update?: BaguioSaleUpdateInput; error?: string } {
  if (!isRecord(value)) return { error: "Enter the revised order details." };
  const deliveryNotes = readText(value.deliveryNotes, 500, true);
  if (deliveryNotes === null) return { error: "Delivery notes must be 500 characters or fewer." };
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) return { error: "Add between 1 and 50 products." };
  const items = value.items.map(readItem);
  if (items.some((item) => item === null)) return { error: "Each product requires a valid quantity and price." };
  const validItems = items.filter((item) => item !== null);
  if (new Set(validItems.map((item) => item.productVariantId)).size !== validItems.length) return { error: "Add each product variant only once." };
  return { update: { deliveryNotes, items: validItems } };
}

export function validateBaguioClientInput(value: unknown): { client?: BaguioClientInput; error?: string } {
  if (!isRecord(value)) return { error: "Enter the client details." };
  const name = readText(value.name, 120);
  const address = readAddress(value.address);
  const phone = readText(value.phone, 30);
  const email = readText(value.email, 254, true);
  const contactPerson = readText(value.contactPerson, 120, true);
  if (!name) return { error: "Enter the client or business name." };
  if (!address) return { error: "Enter a complete Philippine delivery address." };
  if (!phone) return { error: "Enter the client phone number." };
  if (email === null || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Enter a valid email address." };
  if (contactPerson === null) return { error: "Contact person must be 120 characters or fewer." };
  return { client: { name, address, phone, email: email.toLowerCase(), contactPerson } };
}

function readAddress(value: unknown): ShippingAddress | null {
  if (!isRecord(value)) return null;
  const street = readText(value.street, 300);
  const region = readText(value.region, 120);
  const province = readText(value.province, 120, true);
  const locality = readText(value.locality, 120);
  const district = readText(value.district, 120, true);
  const barangay = readText(value.barangay, 120);
  const postalCode = readText(value.postalCode, 12);
  if (!street || !region || province === null || !locality || district === null || !barangay || !postalCode) return null;
  if (value.country !== "Philippines") return null;
  return { street, region, province, locality, district, barangay, postalCode, country: "Philippines" };
}

export function readBaguioSaleAction(value: string): BaguioSaleAction | null {
  return ["submit", "approve", "load", "deliver", "complete"].includes(value)
    ? value as BaguioSaleAction
    : null;
}

export function validateBaguioDispatchInput(value: unknown): { dispatch?: BaguioDispatchInput; error?: string } {
  if (!isRecord(value)) return { error: "Enter the dispatch details." };
  const notes = readText(value.notes, 500, true);
  if (typeof value.vanLocationId !== "string" || !isUuid(value.vanLocationId)) return { error: "Choose a valid van." };
  if (typeof value.driverUserId !== "string" || !isUuid(value.driverUserId)) return { error: "Choose a valid driver." };
  if (notes === null) return { error: "Dispatch notes must be 500 characters or fewer." };
  return { dispatch: { vanLocationId: value.vanLocationId, driverUserId: value.driverUserId, notes } };
}

export function readBaguioDispatchAction(value: string): BaguioDispatchAction | null {
  return value === "start" || value === "complete" ? value : null;
}

function readItem(value: unknown): BaguioSaleInput["items"][number] | null {
  if (!isRecord(value) || typeof value.productVariantId !== "string" || !isUuid(value.productVariantId)) return null;
  if (!Number.isInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 10_000) return null;
  if (typeof value.unitPrice !== "number" || !Number.isFinite(value.unitPrice) || value.unitPrice <= 0 || value.unitPrice > 1_000_000) return null;
  return { productVariantId: value.productVariantId, quantity: Number(value.quantity), unitPrice: value.unitPrice };
}

function readText(value: unknown, maximum: number, optional = false): string | null {
  if (typeof value !== "string") return optional && value === undefined ? "" : null;
  const text = value.trim();
  if ((!optional && !text) || text.length > maximum) return null;
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
