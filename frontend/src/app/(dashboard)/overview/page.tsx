import { useEffect, useState } from "react";
import {
  ChartNoAxesCombined,
  Box,
  MapPinned,
  Package,
  PackagePlus,
  Route,
  ShoppingBag,
  Tags,
  UsersRound,
  Users,
} from "lucide-react";
import { ProductCatalog } from "../../../components/ProductCatalog";
import { OrderTracker } from "../../../components/OrderTracker";
import { CustomersPage } from "../customers/page";
import { StatisticsPage } from "../statistics/page";
import { BaguioSalesPage } from "../baguio-sales/page";
import type { AuthenticatedUser } from "../../../types/auth";
import { AccountMenu } from "./_components/AccountMenu";

type DashboardTab = "overview" | "orders" | "baguio-sales" | "products" | "customers" | "statistics";

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
          <small>Operations</small>
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
          <a className={activeTab === "baguio-sales" ? "active" : undefined} href="#baguio-sales" aria-current={activeTab === "baguio-sales" ? "page" : undefined}>
            <MapPinned />
            <span>Baguio Sales</span>
          </a>
          {activeTab === "baguio-sales" && (
            <div className="ml-5 grid gap-1 border-l border-[#4a4742] pl-3 max-[800px]:hidden" aria-label="Baguio Sales actions">
              <a className="!h-9 !gap-2 !px-3 !text-xs" href="#baguio-sales/new-order"><PackagePlus className="!size-4" /><span>New order</span></a>
              <a className="!h-9 !gap-2 !px-3 !text-xs" href="#baguio-sales/new-dispatch"><Route className="!size-4" /><span>New dispatch</span></a>
              <a className="!h-9 !gap-2 !px-3 !text-xs" href="#baguio-sales/drivers"><UsersRound className="!size-4" /><span>Drivers</span></a>
            </div>
          )}
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
          <AccountMenu
            user={user}
            loggingOut={loggingOut}
            onSignOut={handleLogout}
          />
        </header>
        {activeTab === "products" ? (
          <ProductCatalog csrfToken={user.csrfToken} />
        ) : activeTab === "orders" ? (
          <OrderTracker csrfToken={user.csrfToken} />
        ) : activeTab === "baguio-sales" ? (
          <BaguioSalesPage csrfToken={user.csrfToken} preparedByName={user.name} />
        ) : activeTab === "customers" ? (
          <CustomersPage csrfToken={user.csrfToken} />
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
  if (window.location.hash.startsWith("#baguio-sales")) return "baguio-sales";
  if (window.location.hash.startsWith("#orders")) return "orders";
  if (window.location.hash === "#products") return "products";
  if (window.location.hash.startsWith("#customers")) return "customers";
  if (window.location.hash === "#statistics") return "statistics";
  return "overview";
}

function tabHeading(tab: DashboardTab): string {
  if (tab === "baguio-sales") return "Baguio Sales";
  if (tab === "products") return "Products";
  if (tab === "orders") return "Order tracker";
  if (tab === "customers") return "Customers";
  if (tab === "statistics") return "Statistics";
  return "Shop overview";
}

function tabEyebrow(tab: DashboardTab): string {
  if (tab === "baguio-sales") return "Sales channel";
  if (tab === "products") return "Catalog";
  if (tab === "orders") return "Fulfilment";
  if (tab === "customers") return "Audience insights";
  return "Performance insights";
}
