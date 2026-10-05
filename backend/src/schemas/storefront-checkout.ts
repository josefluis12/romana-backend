import type { CheckoutDetails, CheckoutCustomer, DeliveryLocation, ShippingAddress } from "../types/order.js";
import { StorefrontCheckoutError } from "../services/storefront-checkout-error.js";

function readRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new StorefrontCheckoutError(message);
  return value as Record<string, unknown>;
}

function readText(record: Record<string, unknown>, key: string, label: string, maximum: number, optional = false): string {
  const value = record[key];
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new StorefrontCheckoutError(`${label} is required.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) throw new StorefrontCheckoutError(`Enter a valid ${label.toLowerCase()}.`);
  return trimmed;
}

function readCustomer(record: Record<string, unknown>): CheckoutCustomer {
  const customer = readRecord(record.customer, "Customer information is required.");
  const email = readText(customer, "email", "Email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StorefrontCheckoutError("Enter a valid email address.");
  const phone = normalizePhoneNumber(readText(customer, "phone", "Mobile number", 30));
  return {
    email,
    firstName: readText(customer, "firstName", "First name", 100),
    lastName: readText(customer, "lastName", "Last name", 100),
    phone,
  };
}

function normalizePhoneNumber(value: string): string {
  if (!/^\+?[0-9 ()-]{7,30}$/.test(value)) throw new StorefrontCheckoutError("Enter a valid mobile number.");
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (digits.length < 7 || digits.length > 15) throw new StorefrontCheckoutError("Enter a valid mobile number.");
  return `+${digits}`;
}

function readCoordinate(record: Record<string, unknown>, key: string, label: string, minimum: number, maximum: number): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new StorefrontCheckoutError(`Choose a valid ${label.toLowerCase()}.`);
  }
  return value;
}

function readDeliveryLocation(address: Record<string, unknown>): DeliveryLocation {
  const location = readRecord(address.location, "Confirm the delivery location on the map.");
  return {
    placeId: readText(location, "placeId", "Google Place ID", 255),
    latitude: readCoordinate(location, "latitude", "delivery latitude", -90, 90),
    longitude: readCoordinate(location, "longitude", "delivery longitude", -180, 180),
  };
}

function readAddress(record: Record<string, unknown>): ShippingAddress {
  const address = readRecord(record.shippingAddress, "Delivery address is required.");
  const country = readText(address, "country", "Country", 80);
  if (country !== "Philippines") throw new StorefrontCheckoutError("The delivery country must be Philippines.");
  return {
    street: readText(address, "street", "Street address", 300),
    region: readText(address, "region", "Region", 120),
    province: readText(address, "province", "Province", 120, true),
    locality: readText(address, "locality", "City or municipality", 120),
    district: readText(address, "district", "District", 120, true),
    barangay: readText(address, "barangay", "Barangay", 120),
    postalCode: readText(address, "postalCode", "Postal code", 12),
    country: "Philippines",
    location: readDeliveryLocation(address),
  };
}

export function validateCheckoutDetails(value: unknown): CheckoutDetails {
  const record = readRecord(value, "Checkout details are required.");
  return {
    customer: readCustomer(record),
    shippingAddress: readAddress(record),
    deliveryNotes: readText(record, "deliveryNotes", "Delivery notes", 500, true),
  };
}
