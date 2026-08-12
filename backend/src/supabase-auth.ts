import { createClient, type AuthError, type Session, type User } from "@supabase/supabase-js";

const authOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

interface AuthData {
  session: Session | null;
  user: User | null;
}

interface UserData {
  user: User | null;
}

interface SupabaseAuthClient {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: AuthData; error: AuthError | null }>;
    getUser(accessToken: string): Promise<{ data: UserData; error: AuthError | null }>;
    refreshSession(credentials: { refresh_token: string }): Promise<{ data: AuthData; error: AuthError | null }>;
    setSession(credentials: { access_token: string; refresh_token: string }): Promise<{ data: AuthData; error: AuthError | null }>;
    signOut(options: { scope: "local" }): Promise<{ error: AuthError | null }>;
  };
}

type ClientFactory = (url: string, key: string, options: typeof authOptions) => SupabaseAuthClient;

export interface SupabaseAuthOptions {
  url: string;
  key: string;
  clientFactory?: ClientFactory;
}

export interface AuthResult extends AuthData {
  error: Error | AuthError | null;
}

export interface UserResult extends UserData {
  error: Error | AuthError | null;
}

export interface AuthService {
  isConfigured: boolean;
  signIn(email: string, password: string): Promise<AuthResult>;
  getUser(accessToken?: string): Promise<UserResult>;
  refresh(refreshToken?: string): Promise<AuthResult>;
  signOut(accessToken?: string, refreshToken?: string): Promise<void>;
}

export function createSupabaseAuth({
  url,
  key,
  clientFactory = (clientUrl, clientKey, options) => createClient(clientUrl, clientKey, options),
}: SupabaseAuthOptions): AuthService {
  const isConfigured = Boolean(url && key);
  const client = (): SupabaseAuthClient => clientFactory(url, key, authOptions);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!isConfigured) return { error: new Error("Supabase is not configured."), session: null, user: null };
    const { data, error } = await client().auth.signInWithPassword({ email, password });
    return { error, session: data.session, user: data.user };
  }

  async function getUser(accessToken?: string): Promise<UserResult> {
    if (!isConfigured || !accessToken) return { error: new Error("No active session."), user: null };
    const { data, error } = await client().auth.getUser(accessToken);
    return { error, user: data.user };
  }

  async function refresh(refreshToken?: string): Promise<AuthResult> {
    if (!isConfigured || !refreshToken) return { error: new Error("No refresh token."), session: null, user: null };
    const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
    return { error, session: data.session, user: data.user };
  }

  async function signOut(accessToken?: string, refreshToken?: string): Promise<void> {
    if (!isConfigured || !accessToken || !refreshToken) return;
    const supabase = client();
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (!error) await supabase.auth.signOut({ scope: "local" });
  }

  return { isConfigured, signIn, getUser, refresh, signOut };
}
