import { createClient, type User } from "@supabase/supabase-js";
import type { DispatchDriver, DispatchDriverInput } from "../types/channel-sales.js";

export const DISPATCH_DRIVER_ROLE = "dispatch_driver";

export interface DispatchDriverService {
  list(): Promise<DispatchDriver[]>;
  create(input: DispatchDriverInput): Promise<DispatchDriver>;
}

export function isDispatchDriver(user: User): boolean {
  return user.app_metadata?.role === DISPATCH_DRIVER_ROLE;
}

export function createSupabaseDispatchDriverService(url: string, secretKey: string): DispatchDriverService {
  const client = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  function assertConfigured(): void {
    if (!url || !secretKey) throw new Error("Dispatch driver accounts are not configured.");
  }

  return {
    async list() {
      assertConfigured();
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1_000 });
      if (error) throw new Error("Dispatch driver accounts could not be loaded.");
      return data.users.filter(isDispatchDriver).map(readDriver).sort((left, right) => left.name.localeCompare(right.name));
    },
    async create(input) {
      assertConfigured();
      const { data, error } = await client.auth.admin.createUser({
        email: input.email,
        password: input.temporaryPassword,
        email_confirm: true,
        app_metadata: { role: DISPATCH_DRIVER_ROLE },
        user_metadata: {
          first_name: input.firstName,
          middle_name: input.middleName,
          last_name: input.lastName,
        },
      });
      if (error || !data.user) throw new Error("The driver account could not be created.");
      return readDriver(data.user);
    },
  };
}

function readDriver(user: User): DispatchDriver {
  const firstName = readMetadataName(user, "first_name");
  const middleName = readMetadataName(user, "middle_name");
  const lastName = readMetadataName(user, "last_name");
  const fullName = user.user_metadata?.full_name;
  const separatedName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  return {
    userId: user.id,
    name: separatedName || (typeof fullName === "string" && fullName.trim() ? fullName.trim() : user.email || "Driver"),
    email: user.email || "",
  };
}

function readMetadataName(user: User, field: string): string {
  const value = user.user_metadata?.[field];
  return typeof value === "string" ? value.trim() : "";
}
