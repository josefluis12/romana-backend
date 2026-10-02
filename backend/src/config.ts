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
const isProduction = process.env.NODE_ENV === "production";
const mayaApiUrl = (process.env.MAYA_API_URL || "https://pg-sandbox.paymaya.com").trim();
const mayaSharedSandboxKey = "pk-Z0OSzLvIcOI2UIvDhdTGVVfRSSeiGStnceqwUE7n0Ah";

function isValidSupabaseUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const config = {
  port: positiveInteger(process.env.PORT, 4322),
  isProduction,
  frontendOrigin: (process.env.FRONTEND_ORIGIN || "http://localhost:5173").trim(),
  storefrontOrigin: (process.env.STOREFRONT_ORIGIN || "http://localhost:4321").trim(),
  driverOrigin: (process.env.DRIVER_ORIGIN || "http://localhost:8081").trim(),
  supabaseUrl,
  supabaseKey,
  supabaseSecretKey: (process.env.SUPABASE_SECRET_KEY || "").trim(),
  mayaApiUrl,
  mayaPublicKey: (process.env.MAYA_PUBLIC_KEY || (!isProduction && mayaApiUrl === "https://pg-sandbox.paymaya.com" ? mayaSharedSandboxKey : "")).trim(),
};

if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be a valid HTTPS project URL.");
}

if (config.isProduction && (!supabaseUrl || !supabaseKey || !config.supabaseSecretKey)) {
  throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY are required in production.");
}
