export interface DriverAppConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type ConfigResult =
  | { config: DriverAppConfig; error?: never }
  | { config?: never; error: string };

function readHttpsUrl(value: string | undefined, label: string, allowHttp: boolean): URL | string {
  try {
    const url = new URL(value ?? "");
    if (url.protocol === "https:" || (allowHttp && url.protocol === "http:")) return url;
  } catch {
    // The error below gives the operator one consistent setup message.
  }
  return `${label} is missing or invalid.`;
}

export function readDriverAppConfig(): ConfigResult {
  const supabaseUrl = readHttpsUrl(process.env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL", false);
  if (typeof supabaseUrl === "string") return { error: supabaseUrl };

  const apiUrl = readHttpsUrl(process.env.EXPO_PUBLIC_API_URL, "EXPO_PUBLIC_API_URL", __DEV__);
  if (typeof apiUrl === "string") return { error: apiUrl };

  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabasePublishableKey) return { error: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing." };

  return {
    config: {
      apiUrl: apiUrl.toString().replace(/\/$/, ""),
      supabaseUrl: supabaseUrl.toString().replace(/\/$/, ""),
      supabasePublishableKey,
    },
  };
}
