import { createClient, type User } from "@supabase/supabase-js";
import type { DispatchDriver } from "../types/channel-sales.js";
import type { SystemUser, SystemUserInput, SystemUserRole } from "../types/system-user.js";

export const ADMINISTRATOR_ROLE = "administrator";
export const DISPATCH_DRIVER_ROLE = "dispatch_driver";

export interface SystemUserService {
  list(): Promise<SystemUser[]>;
  listDrivers(): Promise<DispatchDriver[]>;
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
