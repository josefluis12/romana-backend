import { fetchWithCsrf } from "./products";
import type { CreateSystemUserInput, SystemUser } from "../types/system-user";

interface ErrorResponse { error?: string }

export async function listSystemUsers(): Promise<SystemUser[]> {
  const response = await fetch("/api/system-users", { credentials: "include" });
  const result = await readJson<{ users?: SystemUser[]; error?: string }>(response);
  if (!response.ok || !result.users) throw new Error(result.error || "Unable to load system users.");
  return result.users;
}

export async function createSystemUser(input: CreateSystemUserInput, csrfToken: string): Promise<SystemUser> {
  const response = await fetchWithCsrf("/api/system-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<{ user?: SystemUser; error?: string }>(response);
  if (!response.ok || !result.user) throw new Error(result.error || "Unable to create the user account.");
  return result.user;
}

async function readJson<T extends ErrorResponse>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}
