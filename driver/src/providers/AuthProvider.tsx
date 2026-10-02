import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { readDriverAppConfig, type DriverAppConfig } from "../lib/config";
import { getSupabase } from "../lib/supabase";

interface AuthContextValue {
  config: DriverAppConfig | null;
  configError: string | null;
  session: Session | null;
  isInitializing: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const appConfigResult = readDriverAppConfig();

async function restoreSession(client: SupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  return error ? null : data.session;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const config = appConfigResult.config ?? null;
  const client = config ? getSupabase(config) : null;
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(Boolean(client));

  useEffect(() => {
    if (!client) return;
    let isMounted = true;
    void restoreSession(client)
      .then((restored) => {
        if (isMounted) setSession(restored);
      })
      .finally(() => {
        if (isMounted) setIsInitializing(false);
      });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  async function signIn(email: string, password: string): Promise<void> {
    if (!client) throw new Error("The driver app has not been configured.");
    const result = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (result.error || !result.data.session) {
      throw new Error("That email and password combination was not recognized.");
    }
    setSession(result.data.session);
  }

  async function signOut(): Promise<void> {
    if (client) await client.auth.signOut();
    setSession(null);
  }

  const value: AuthContextValue = {
    config,
    configError: appConfigResult.error ?? null,
    session,
    isInitializing,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
