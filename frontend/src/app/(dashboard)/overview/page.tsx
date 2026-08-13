import { useEffect, useState } from "react";
import {
  Box,
  LogOut,
  Package,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import { ProductCatalog } from "../../../components/ProductCatalog";
import type { AuthenticatedUser } from "../../../types/auth";

interface DashboardPageProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "products">(
    window.location.hash === "#products" ? "products" : "overview",
  );
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    function syncTabWithHash() {
      setActiveTab(
        window.location.hash === "#products" ? "products" : "overview",
      );
    }

    window.addEventListener("hashchange", syncTabWithHash);
    return () => window.removeEventListener("hashchange", syncTabWithHash);
  }, []);

  useEffect(() => {
    document.title = `${activeTab === "products" ? "Products" : "Dashboard"} | Romana Admin`;
  }, [activeTab]);

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
        <div className="sidebar-brand">
          <span>Romana</span>
          <small>Shop admin</small>
        </div>
        <nav aria-label="Main navigation">
          <a
            className={activeTab === "overview" ? "active" : undefined}
            href="#overview"
            aria-current={activeTab === "overview" ? "page" : undefined}
          >
            <ShoppingBag />
            <span>Overview</span>
          </a>
          <a href="#orders">
            <Package />
            <span>Orders</span>
          </a>
          <a
            className={activeTab === "products" ? "active" : undefined}
            href="#products"
            aria-current={activeTab === "products" ? "page" : undefined}
          >
            <Tags />
            <span>Products</span>
          </a>
          <a href="#customers">
            <Users />
            <span>Customers</span>
          </a>
        </nav>
        <div className="account-block">
          <span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>Administrator</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>

      <main className="dashboard" id={activeTab}>
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              {activeTab === "products" ? "Catalog" : today}
            </p>
            <h1>{activeTab === "products" ? "Products" : "Shop overview"}</h1>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
          >
            <LogOut />
            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </header>
        {activeTab === "products" ? (
          <ProductCatalog csrfToken={user.csrfToken} />
        ) : (
          <>
            <section className="welcome-band">
              <div>
                <p className="eyebrow">All systems ready</p>
                <h2>Welcome back to Romana.</h2>
                <p>
                  Your shop workspace is ready for orders, products, and customer
                  management.
                </p>
              </div>
            </section>
            <section className="metrics" aria-label="Shop metrics">
              <article>
                <span>Orders today</span>
                <strong>0</strong>
                <small>Order management is next</small>
              </article>
              <article>
                <span>Products</span>
                <strong>0</strong>
                <small>Catalog connection pending</small>
              </article>
              <article>
                <span>Customers</span>
                <strong>0</strong>
                <small>Customer records pending</small>
              </article>
            </section>
            <section className="empty-state">
              <Box />
              <h2>Your operations hub starts here</h2>
              <p>
                The secure portal is in place. Orders, inventory, and shop controls
                can now be added one workflow at a time.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
