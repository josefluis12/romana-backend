import {
  ChartNoAxesCombined,
  MapPinned,
  Package,
  ShoppingBag,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type DashboardTab = "overview" | "orders" | "baguio-sales" | "products" | "customers" | "users" | "statistics";

export function SidebarNavigation({ activeTab }: { activeTab: DashboardTab }) {
  return (
    <nav className="max-[800px]:w-full max-[800px]:overflow-x-auto" aria-label="Main navigation">
      <NavGroup label="Workspace">
        <NavItem activeTab={activeTab} tab="overview" label="Overview" icon={ShoppingBag} />
      </NavGroup>
      <NavGroup label="Operations">
        <NavItem activeTab={activeTab} tab="orders" label="Orders" icon={Package} />
        <NavItem activeTab={activeTab} tab="baguio-sales" label="Baguio Sales" icon={MapPinned} />
      </NavGroup>
      <NavGroup label="Business">
        <NavItem activeTab={activeTab} tab="products" label="Products" icon={Tags} />
        <NavItem activeTab={activeTab} tab="customers" label="Customers" icon={Users} />
        <NavItem activeTab={activeTab} tab="statistics" label="Statistics" icon={ChartNoAxesCombined} />
      </NavGroup>
      <NavGroup label="Administration">
        <NavItem activeTab={activeTab} tab="users" label="System Users" icon={UserCog} />
      </NavGroup>
    </nav>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 pt-3 first:pt-0 max-[800px]:contents">
      <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736c] max-[800px]:hidden">{label}</p>
      {children}
    </div>
  );
}

function NavItem({ activeTab, tab, label, icon: Icon }: {
  activeTab: DashboardTab;
  tab: DashboardTab;
  label: string;
  icon: LucideIcon;
}) {
  const active = activeTab === tab;
  return (
    <a className={active ? "active" : undefined} href={`#${tab}`} aria-current={active ? "page" : undefined} aria-label={label}>
      <Icon />
      <span>{label}</span>
    </a>
  );
}
