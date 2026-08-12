import { loadEnvFile } from "node:process";

try {
  loadEnvFile(new URL("../.env", import.meta.url));
} catch (error: unknown) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

function isValidSupabaseUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const config = {
  port: positiveInteger(process.env.PORT, 4322),
  isProduction: process.env.NODE_ENV === "production",
  frontendOrigin: (process.env.FRONTEND_ORIGIN || "http://localhost:5173").trim(),
  supabaseUrl,
  supabaseKey,
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};

if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be a valid HTTPS project URL.");
}

if (config.isProduction && (!supabaseUrl || !supabaseKey || config.adminEmails.length === 0)) {
  throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and ADMIN_EMAILS are required in production.");
}
