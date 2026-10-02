import { createClient, type User } from "@supabase/supabase-js";
import type { DispatchDriver } from "../types/channel-sales.js";
import type { SystemUser, SystemUserInput, SystemUserLog, SystemUserLogCategory, SystemUserProfile, SystemUserRole } from "../types/system-user.js";

export const ADMINISTRATOR_ROLE = "administrator";
export const DISPATCH_DRIVER_ROLE = "dispatch_driver";

export interface SystemUserService {
  list(): Promise<SystemUser[]>;
  listDrivers(): Promise<DispatchDriver[]>;
  getProfile(userId: string): Promise<SystemUserProfile | null>;
  create(input: SystemUserInput): Promise<SystemUser>;
}

export function isDispatchDriver(user: User): boolean {
  return user.app_metadata?.role === DISPATCH_DRIVER_ROLE;
}

export function createSupabaseSystemUserService(url: string, secretKey: string): SystemUserService {
  const client = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  async function listUsers(): Promise<User[]> {
    if (!url || !secretKey) throw new Error("System user accounts are not configured.");
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1_000 });
    if (error) throw new Error("System user accounts could not be loaded.");
    return data.users;
  }

  return {
    async list() {
      return (await listUsers()).map(readSystemUser).sort(compareUsers);
    },
    async listDrivers() {
      return (await listUsers()).filter(isDispatchDriver).map((user) => {
        const account = readSystemUser(user);
        return { userId: account.userId, name: account.name, email: account.email };
      }).sort((left, right) => left.name.localeCompare(right.name));
    },
    async getProfile(userId) {
      if (!url || !secretKey) throw new Error("System user accounts are not configured.");
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error) {
        if (error.status === 404) return null;
        throw new Error("The user account could not be loaded.");
      }
      if (!data.user) return null;
      const logs = await loadUserLogs(url, secretKey, userId);
      return {
        ...readSystemUser(data.user),
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at ?? null,
        logs,
      };
    },
    async create(input) {
      if (!url || !secretKey) throw new Error("System user accounts are not configured.");
      const { data, error } = await client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: { role: input.role },
        user_metadata: { first_name: input.firstName, middle_name: input.middleName, last_name: input.lastName },
      });
      if (error || !data.user) throw new Error("The user account could not be created.");
      return readSystemUser(data.user);
    },
  };
}

async function loadUserLogs(url: string, secretKey: string, userId: string): Promise<SystemUserLog[]> {
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const actorFilter = `actor_user_id=eq.${encodeURIComponent(userId)}`;
  const requests = [
    fetch(`${url}/rest/v1/order_status_events?select=id,status,created_at,orders(request_reference_number)&${actorFilter}&order=created_at.desc&limit=100`, { headers }),
    fetch(`${url}/rest/v1/channel_sale_events?select=id,status,created_at,channel_sales_orders(reference_number)&${actorFilter}&order=created_at.desc&limit=100`, { headers }),
    fetch(`${url}/rest/v1/channel_sale_revisions?select=id,created_at,channel_sales_orders(reference_number)&${actorFilter}&order=created_at.desc&limit=100`, { headers }),
  ];
  const responses = await Promise.all(requests);
  if (responses.some((response) => !response.ok)) throw new Error("User activity could not be loaded.");
  const values: unknown[] = await Promise.all(responses.map((response) => response.json()));
  return [
    ...readLogs(values[0], "online_order", "orders"),
    ...readLogs(values[1], "baguio_sale", "channel_sales_orders"),
    ...readLogs(values[2], "baguio_sale_revision", "channel_sales_orders"),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 100);
}

function readLogs(value: unknown, category: SystemUserLogCategory, relation: string): SystemUserLog[] {
  if (!Array.isArray(value)) throw new Error("User activity returned invalid data.");
  return value.map((entry) => {
    if (!isRecord(entry)) throw new Error("User activity returned invalid data.");
    const related = readRelatedRecord(entry[relation]);
    const reference = category === "online_order" ? related.request_reference_number : related.reference_number;
    if (typeof entry.id !== "string" || typeof entry.created_at !== "string" || typeof reference !== "string") {
      throw new Error("User activity returned invalid data.");
    }
    const action = category === "baguio_sale_revision" ? "revised" : entry.status;
    if (typeof action !== "string") throw new Error("User activity returned invalid data.");
    return { id: entry.id, category, action, referenceNumber: reference, createdAt: entry.created_at };
  });
}

function readRelatedRecord(value: unknown): Record<string, unknown> {
  const related = Array.isArray(value) ? value[0] : value;
  if (!isRecord(related)) throw new Error("User activity returned invalid data.");
  return related;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSystemUser(user: User): SystemUser {
  const names = ["first_name", "middle_name", "last_name"].map((field) => readMetadataName(user, field)).filter(Boolean);
  const fullName = user.user_metadata?.full_name;
  return {
    userId: user.id,
    name: names.join(" ") || (typeof fullName === "string" && fullName.trim() ? fullName.trim() : user.email || "User"),
    email: user.email || "",
    role: readSystemRole(user),
  };
}

function readSystemRole(user: User): SystemUserRole {
  return isDispatchDriver(user) ? DISPATCH_DRIVER_ROLE : ADMINISTRATOR_ROLE;
}

function readMetadataName(user: User, field: string): string {
  const value = user.user_metadata?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function compareUsers(left: SystemUser, right: SystemUser): number {
  return left.name.localeCompare(right.name);
}
