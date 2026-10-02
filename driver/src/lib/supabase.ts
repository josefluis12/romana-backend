import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { DriverAppConfig } from "./config";
import { secureSessionStorage } from "./secure-storage";

const memoryValues = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string): string | null => memoryValues.get(key) ?? null,
  setItem: (key: string, value: string): void => void memoryValues.set(key, value),
  removeItem: (key: string): void => void memoryValues.delete(key),
};

let client: SupabaseClient | null = null;
let appStateSubscription: { remove(): void } | null = null;

export function getSupabase(config: DriverAppConfig): SupabaseClient {
  if (client) return client;
  const isNative = Platform.OS !== "web";
  client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      storage: isNative ? secureSessionStorage : memoryStorage,
      autoRefreshToken: true,
      persistSession: isNative,
      detectSessionInUrl: false,
    },
  });

  if (isNative && !appStateSubscription) {
    appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
