import type { BaguioDispatch, DispatchDriver } from "../types/channel-sales.js";

export function readDispatchDriver(value: Record<string, unknown>): BaguioDispatch["driver"] {
  const userId = readNullableString(value.driver_user_id);
  if (!userId) return null;
  return { userId, name: readString(value.driver_name), email: readString(value.driver_email) };
}

export async function loadDispatchDriver(url: string, secretKey: string, userId: string): Promise<DispatchDriver> {
  const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  const value: unknown = await response.json();
  if (!response.ok || !isRecord(value) || !isRecord(value.app_metadata) || value.app_metadata.role !== "dispatch_driver") {
    throw new Error("Dispatch driver account not found.");
  }
  const metadata = isRecord(value.user_metadata) ? value.user_metadata : {};
  const email = readString(value.email);
  const firstName = readOptionalString(metadata.first_name);
  const middleName = readOptionalString(metadata.middle_name);
  const lastName = readOptionalString(metadata.last_name);
  const separatedName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const fullName = readOptionalString(metadata.full_name);
  return {
    userId: readString(value.id),
    name: separatedName || fullName || email,
    email,
  };
}

function readNullableString(value: unknown): string | null {
  if (value === null) return null;
  return readString(value);
}

function readString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Dispatch driver account returned invalid data.");
  return value;
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
