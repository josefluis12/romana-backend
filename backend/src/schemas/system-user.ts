import type { SystemUserInput, SystemUserRole } from "../types/system-user.js";

const SYSTEM_USER_ROLES: SystemUserRole[] = ["administrator", "dispatch_driver"];

export function validateSystemUserInput(value: unknown): { user?: SystemUserInput; error?: string } {
  if (!isRecord(value)) return { error: "Enter the user account details." };
  const firstName = readText(value.firstName, 100);
  const middleName = readText(value.middleName, 100, true);
  const lastName = readText(value.lastName, 100);
  const email = readText(value.email, 254);
  const password = readText(value.password, 128);
  const passwordConfirmation = readText(value.passwordConfirmation, 128);

  if (!firstName) return { error: "Enter the user's first name." };
  if (middleName === null) return { error: "The user's middle name must be 100 characters or fewer." };
  if (!lastName) return { error: "Enter the user's last name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid user email address." };
  if (!isSystemUserRole(value.role)) return { error: "Choose a valid user role." };
  if (!password || password.length < 12) return { error: "Use a password with at least 12 characters." };
  if (passwordConfirmation !== password) return { error: "The password confirmation does not match." };

  return { user: { firstName, middleName, lastName, email: email.toLowerCase(), role: value.role, password } };
}

function isSystemUserRole(value: unknown): value is SystemUserRole {
  return typeof value === "string" && SYSTEM_USER_ROLES.includes(value as SystemUserRole);
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
