import type { BaguioClient } from "../types/channel-sales.js";

export function readBaguioClient(value: unknown): BaguioClient {
  if (!isRecord(value)) throw new Error("Baguio client directory returned invalid data.");
  return {
    id: readString(value.id),
    referenceNumber: readString(value.reference_number),
    name: readCustomerName(value),
    address: readString(value.default_address),
    structuredAddress: readAddress(value.default_shipping_address),
    phone: readString(value.phone),
    email: readNullableString(value.email) ?? "",
    contactPerson: readString(value.contact_person),
    isActive: readBoolean(value.is_active),
    createdAt: readString(value.created_at),
  };
}

function readAddress(value: unknown): BaguioClient["structuredAddress"] {
  if (value === null) return null;
  if (!isRecord(value) || value.country !== "Philippines") {
    throw new Error("Customer directory returned invalid address data.");
  }
  return {
    street: readString(value.street),
    region: readString(value.region),
    province: readString(value.province),
    locality: readString(value.locality),
    district: readString(value.district),
    barangay: readString(value.barangay),
    postalCode: readString(value.postalCode),
    country: "Philippines",
  };
}

function readCustomerName(value: Record<string, unknown>): string {
  const businessName = readNullableString(value.business_name);
  return businessName || `${readString(value.first_name)} ${readString(value.last_name)}`.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Baguio client directory returned invalid data.");
  return value;
}

function readNullableString(value: unknown): string | null {
  return value === null ? null : readString(value);
}

function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Baguio client directory returned invalid data.");
  return value;
}
