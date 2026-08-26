import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { DashboardPage } from "./app/(dashboard)/overview/page";
import type { AuthenticatedUser } from "./types/auth";
import "./app.css";
import "./styles/orders.css";
import "./styles/customers.css";
import "./styles/tailwind.css";

interface SessionResponse {
  authenticated: boolean;
  user?: { email?: string };
  csrfToken?: string;
}

interface LoginResponse {
  user?: { email?: string };
  csrfToken?: string;
  error?: string;
}

function Login({ onLogin, initialError = "" }: { onLogin: (user: AuthenticatedUser) => void; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in | Romana Admin";
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        return;
      }
      onLogin({
        email: result.user?.email || "Administrator",
        csrfToken: result.csrfToken || "",
      });
    } catch {
      setError("The admin API is unavailable. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="brand-panel" aria-label="Romana shop administration">
        <div className="brand-mark">
          <img className="brand-logo" src="/logo.png" alt="Romana Peanut Brittle" />
        </div>
      </section>

      <section className="login-panel">
        <div className="login-wrap">
          <div className="mobile-brand">
            <img className="brand-logo" src="/logo.png" alt="Romana Peanut Brittle" />
            <small>Admin</small>
          </div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your shop</h2>
          <p className="muted">Use your administrator account to continue.</p>
          {error && <div className="alert" role="alert">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@romana.ph" required autoFocus />
            <div className="label-row"><label htmlFor="password">Password</label></div>
            <div className="password-field">
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
              <button className="icon-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <button className="primary-button" type="submit" disabled={submitting}>
              <span>{submitting ? "Signing in..." : "Sign in"}</span><ArrowRight />
            </button>
          </form>
          <p className="support">Account access is managed by the shop owner.</p>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        if (response.ok) {
          const session = (await response.json()) as SessionResponse;
          if (session.authenticated) {
            setUser({ email: session.user?.email || "Administrator", csrfToken: session.csrfToken || "" });
          }
        }
      } catch {
        setStartupError("The admin API is unavailable. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    }
    void loadSession();
  }, []);

  if (loading) return <div className="loading-screen" role="status">Loading Romana Admin...</div>;
  if (user) return <DashboardPage user={user} onLogout={() => setUser(null)} />;
  return <Login onLogin={setUser} initialError={startupError} />;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing.");
createRoot(root).render(<App />);
