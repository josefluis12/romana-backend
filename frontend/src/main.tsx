import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Box, Eye, EyeOff, LogOut, Package, ShoppingBag, Users } from "lucide-react";
import "./app.css";

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

interface AuthenticatedUser {
  email: string;
  csrfToken: string;
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

function Dashboard({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const today = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  useEffect(() => {
    document.title = "Dashboard | Romana Admin";
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken: user.csrfToken }),
      });
    } finally {
      onLogout();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span>Romana</span><small>Shop admin</small></div>
        <nav aria-label="Main navigation">
          <a className="active" href="#overview"><ShoppingBag /><span>Overview</span></a>
          <a href="#orders"><Package /><span>Orders</span></a>
          <a href="#customers"><Users /><span>Customers</span></a>
        </nav>
        <div className="account-block">
          <span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          <div><strong>Administrator</strong><small>{user.email}</small></div>
        </div>
      </aside>

      <main className="dashboard" id="overview">
        <header className="dashboard-header">
          <div><p className="eyebrow">{today}</p><h1>Shop overview</h1></div>
          <button className="secondary-button" type="button" onClick={handleLogout} disabled={loggingOut} title="Sign out"><LogOut /><span>{loggingOut ? "Signing out..." : "Sign out"}</span></button>
        </header>
        <section className="welcome-band">
          <div><p className="eyebrow">All systems ready</p><h2>Welcome back to Romana.</h2><p>Your shop workspace is ready for orders, products, and customer management.</p></div>
          <span className="seal">Since<br /><strong>1950</strong></span>
        </section>
        <section className="metrics" aria-label="Shop metrics">
          <article><span>Orders today</span><strong>0</strong><small>Order management is next</small></article>
          <article><span>Products</span><strong>0</strong><small>Catalog connection pending</small></article>
          <article><span>Customers</span><strong>0</strong><small>Customer records pending</small></article>
        </section>
        <section className="empty-state"><Box /><h2>Your operations hub starts here</h2><p>The secure portal is in place. Orders, inventory, and shop controls can now be added one workflow at a time.</p></section>
      </main>
    </div>
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
  if (user) return <Dashboard user={user} onLogout={() => setUser(null)} />;
  return <Login onLogin={setUser} initialError={startupError} />;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing.");
createRoot(root).render(<App />);
