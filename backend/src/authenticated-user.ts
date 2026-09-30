import type { User } from "@supabase/supabase-js";

export function getAuthenticatedUserName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown>;
  const directName = readName(metadata.full_name) || readName(metadata.name);
  if (directName) return directName;

  const combinedName = [readName(metadata.first_name), readName(metadata.last_name)]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return combinedName || user.email || "Administrator";
}

function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= 120 ? name : null;
}
