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

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root is missing.");

const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  } as Record<string, string>)[character] ?? character);

const icon = (name: "eye" | "arrow" | "logout" | "bag" | "box" | "users"): string => {
  const paths = {
    eye: '<path d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
    bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    box: '<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/><path d="M12 13v8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
};

function renderLogin(error = "", email = ""): void {
  document.title = "Sign in | Romana Admin";
  app.innerHTML = `
    <main class="login-page">
      <section class="brand-panel" aria-label="Romana shop administration">
        <div class="brand-mark"><span>Romana</span></div>
        <div class="brand-copy"><p class="eyebrow">Shop administration</p><h1>Good products.<br>Well looked after.</h1><p>Manage the day-to-day details behind the Romana shop.</p></div>
        <p class="brand-footer">Romana Peanut Products · San Jose City</p>
      </section>
      <section class="login-panel"><div class="login-wrap">
        <div class="mobile-brand"><span>Romana</span><small>Admin</small></div>
        <p class="eyebrow">Welcome back</p><h2>Sign in to your shop</h2><p class="muted">Use your administrator account to continue.</p>
        ${error ? `<div class="alert" role="alert">${escapeHtml(error)}</div>` : ""}
        <form class="login-form" id="login-form">
          <label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" value="${escapeHtml(email)}" placeholder="admin@romana.ph" required autofocus>
          <div class="label-row"><label for="password">Password</label></div>
          <div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button class="icon-button" type="button" id="toggle-password" aria-label="Show password" title="Show password">${icon("eye")}</button></div>
          <button class="primary-button" type="submit"><span>Sign in</span>${icon("arrow")}</button>
        </form><p class="support">Account access is managed by the shop owner.</p>
      </div></section>
    </main>`;

  const password = document.querySelector<HTMLInputElement>("#password");
  document.querySelector("#toggle-password")?.addEventListener("click", () => {
    if (!password) return;
    password.type = password.type === "text" ? "password" : "text";
    password.focus();
  });
  document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", handleLogin);
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const formData = new FormData(form);
  const email = String(formData.get("email") || "");
  const response = await fetch("/api/auth/login", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: formData.get("password") }),
  });
  const result = await response.json() as LoginResponse;
  if (!response.ok) return renderLogin(result.error || "Unable to sign in.", email);
  renderDashboard(result.user?.email || "Administrator", result.csrfToken || "");
}

function renderDashboard(email: string, csrfToken: string): void {
  document.title = "Dashboard | Romana Admin";
  const today = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  app.innerHTML = `
    <div class="app-shell"><aside class="sidebar">
      <div class="sidebar-brand"><span>Romana</span><small>Shop admin</small></div>
      <nav aria-label="Main navigation"><a class="active" href="#">${icon("bag")}<span>Overview</span></a><a href="#orders">${icon("box")}<span>Orders</span></a><a href="#customers">${icon("users")}<span>Customers</span></a></nav>
      <div class="account-block"><span class="avatar">${escapeHtml(email.slice(0, 1).toUpperCase())}</span><div><strong>Administrator</strong><small>${escapeHtml(email)}</small></div></div>
    </aside><main class="dashboard">
      <header class="dashboard-header"><div><p class="eyebrow">${escapeHtml(today)}</p><h1>Shop overview</h1></div><button class="secondary-button" id="logout" type="button">${icon("logout")}<span>Sign out</span></button></header>
      <section class="welcome-band"><div><p class="eyebrow">All systems ready</p><h2>Welcome back to Romana.</h2><p>Your shop workspace is ready for orders, products, and customer management.</p></div><span class="seal">Since<br><strong>1950</strong></span></section>
      <section class="metrics" aria-label="Shop metrics"><article><span>Orders today</span><strong>0</strong><small>Order management is next</small></article><article><span>Products</span><strong>0</strong><small>Catalog connection pending</small></article><article><span>Customers</span><strong>0</strong><small>Customer records pending</small></article></section>
      <section class="empty-state">${icon("box")}<h2>Your operations hub starts here</h2><p>The secure portal is in place. Orders, inventory, and shop controls can now be added one workflow at a time.</p></section>
    </main></div>`;
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrfToken }) });
    renderLogin();
  });
}

async function bootstrap(): Promise<void> {
  try {
    const response = await fetch("/api/auth/session", { credentials: "include" });
    if (!response.ok) return renderLogin();
    const session = await response.json() as SessionResponse;
    if (session.authenticated) return renderDashboard(session.user?.email || "Administrator", session.csrfToken || "");
  } catch {
    return renderLogin("The admin API is unavailable. Please try again shortly.");
  }
  renderLogin();
}

void bootstrap();
