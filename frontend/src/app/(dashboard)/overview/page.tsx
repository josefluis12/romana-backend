import { useEffect, useState } from "react";
import {
  ChartNoAxesCombined,
  Box,
  LogOut,
  Package,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import { ProductCatalog } from "../../../components/ProductCatalog";
import { OrderTracker } from "../../../components/OrderTracker";
import { CustomerAnalytics } from "../../../components/CustomerAnalytics";
import { StatisticsPage } from "../statistics/page";
import type { AuthenticatedUser } from "../../../types/auth";

type DashboardTab = "overview" | "orders" | "products" | "customers" | "statistics";

interface DashboardPageProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>(readTab);
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    function syncTabWithHash() {
      setActiveTab(readTab());
    }

    window.addEventListener("hashchange", syncTabWithHash);
    return () => window.removeEventListener("hashchange", syncTabWithHash);
  }, []);

  useEffect(() => {
    document.title = `${tabHeading(activeTab)} | Romana Admin`;
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
      <aside className="sidebar min-w-0">
        <div className="sidebar-brand">
          <img className="sidebar-logo" src="/logo.png" alt="Romana" />
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
          <a className={activeTab === "orders" ? "active" : undefined} href="#orders" aria-current={activeTab === "orders" ? "page" : undefined}>
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
          <a className={activeTab === "customers" ? "active" : undefined} href="#customers" aria-current={activeTab === "customers" ? "page" : undefined}>
            <Users />
            <span>Customers</span>
          </a>
          <a className={activeTab === "statistics" ? "active" : undefined} href="#statistics" aria-current={activeTab === "statistics" ? "page" : undefined}>
            <ChartNoAxesCombined />
            <span>Statistics</span>
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

      <main className="dashboard min-w-0" id={activeTab}>
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              {activeTab === "overview" ? today : tabEyebrow(activeTab)}
            </p>
            <h1>{tabHeading(activeTab)}</h1>
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
        ) : activeTab === "orders" ? (
          <OrderTracker csrfToken={user.csrfToken} />
        ) : activeTab === "customers" ? (
          <CustomerAnalytics />
        ) : activeTab === "statistics" ? (
          <StatisticsPage />
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

function readTab(): DashboardTab {
  if (window.location.hash.startsWith("#orders")) return "orders";
  if (window.location.hash === "#products") return "products";
  if (window.location.hash.startsWith("#customers")) return "customers";
  if (window.location.hash === "#statistics") return "statistics";
  return "overview";
}

function tabHeading(tab: DashboardTab): string {
  if (tab === "products") return "Products";
  if (tab === "orders") return "Order tracker";
  if (tab === "customers") return "Customers";
  if (tab === "statistics") return "Statistics";
  return "Shop overview";
}

function tabEyebrow(tab: DashboardTab): string {
  if (tab === "products") return "Catalog";
  if (tab === "orders") return "Fulfilment";
  if (tab === "customers") return "Audience insights";
  return "Performance insights";
}
