import { useEffect, useMemo, useState } from "react";
import { BarChart3, Map, RefreshCw, Search, UsersRound } from "lucide-react";
import { listCustomerOrders, listOrders } from "../services/orders";
import type { Order } from "../types/order";
import { summarizeCustomers, summarizeRegions } from "./customer-analytics";
import { CustomerDetails } from "./CustomerDetails";
import { PhilippinesRegionMap } from "./PhilippinesRegionMap";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" });

export function CustomerAnalytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(readSelectedCustomerId);
  const [customerOrders, setCustomerOrders] = useState<Order[] | null>(null);
  const [customerOrdersError, setCustomerOrdersError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOrders(await listOrders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load customer analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let active = true;
    setCustomerOrders(null);
    setCustomerOrdersError("");
    if (!selectedCustomerId) return () => { active = false; };
    listCustomerOrders(selectedCustomerId)
      .then((result) => { if (active) setCustomerOrders(result); })
      .catch((cause: unknown) => {
        if (active) setCustomerOrdersError(cause instanceof Error ? cause.message : "Unable to load customer orders.");
      });
    return () => { active = false; };
  }, [selectedCustomerId]);

  useEffect(() => {
    function syncSelectedCustomer() {
      setSelectedCustomerId(readSelectedCustomerId());
    }
    window.addEventListener("hashchange", syncSelectedCustomer);
    return () => window.removeEventListener("hashchange", syncSelectedCustomer);
  }, []);

  const customers = useMemo(() => summarizeCustomers(orders), [orders]);
  const regions = useMemo(() => summarizeRegions(orders), [orders]);
  const visibleCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.email} ${customer.phone} ${customer.location}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const returningCustomers = customers.filter((customer) => customer.orderCount > 1).length;
  const averageOrder = orders.length ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0;

  if (loading) return <div className="catalog-status" role="status">Loading customer insights…</div>;

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  if (selectedCustomer) {
    const completeSummary = customerOrders ? summarizeCustomers(customerOrders)[0] : undefined;
    return (
      <CustomerDetails
        customer={completeSummary ?? selectedCustomer}
        error={customerOrdersError}
        loading={customerOrders === null && !customerOrdersError}
        orders={customerOrders ?? []}
      />
    );
  }

  return (
    <section className="customer-analytics">
      <div className="customer-toolbar">
        <p>Customer records are generated from verified online orders.</p>
        <button className="secondary-button" type="button" onClick={() => void load()} title="Refresh customer analytics">
          <RefreshCw /><span>Refresh</span>
        </button>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <section className="customer-metrics" aria-label="Customer statistics">
        <Metric label="Total customers" value={String(customers.length)} detail={`${orders.length} online orders`} />
        <Metric label="Returning customers" value={String(returningCustomers)} detail={customers.length ? `${Math.round((returningCustomers / customers.length) * 100)}% of customers` : "No order history yet"} />
        <Metric label="Average order" value={peso.format(averageOrder)} detail="Across online orders" />
        <Metric label="Regions served" value={String(regions.length)} detail="Based on shipping addresses" />
      </section>
      <div className="demographics-grid">
        <section className="analytics-card map-card">
          <header><div><span className="card-icon"><Map /></span><div><h2>Order demographics</h2><p>All online orders mapped by shipping region</p></div></div></header>
          <PhilippinesRegionMap regions={regions} />
        </section>
        <section className="analytics-card bar-card">
          <header><div><span className="card-icon"><BarChart3 /></span><div><h2>Online orders by region</h2><p>Order volume and revenue from shipping addresses</p></div></div></header>
          <RegionBars regions={regions} />
        </section>
      </div>
      <section className="customer-directory">
        <header>
          <div><UsersRound /><div><h2>Customer directory</h2><p>{customers.length} customer{customers.length === 1 ? "" : "s"} with completed checkout records</p></div></div>
          <label className="customer-search"><span className="sr-only">Search customers</span><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" /></label>
        </header>
        <CustomerTable customers={visibleCustomers} />
      </section>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function RegionBars({ regions }: { regions: ReturnType<typeof summarizeRegions> }) {
  const maximum = Math.max(...regions.map((region) => region.orderCount), 1);
  if (!regions.length) return <div className="chart-empty">No regional orders yet.</div>;
  return <div className="region-bars">{regions.map((region) => (
    <div className="region-bar" key={region.name}>
      <div><strong>{region.name}</strong><span>{region.orderCount} order{region.orderCount === 1 ? "" : "s"}</span></div>
      <div className="bar-track"><span style={{ width: `${Math.max((region.orderCount / maximum) * 100, 4)}%` }} /></div>
      <small>{peso.format(region.revenue)}</small>
    </div>
  ))}</div>;
}

function CustomerTable({ customers }: { customers: ReturnType<typeof summarizeCustomers> }) {
  if (!customers.length) return <div className="chart-empty">No matching customers.</div>;
  return <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>Customer</th><th>Contact</th><th>Latest location</th><th>Orders</th><th>Total spent</th><th>Last order</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{customers.map((customer) => (
    <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.orderCount > 1 ? "Returning" : "New customer"}</small></td><td><a href={`mailto:${customer.email}`}>{customer.email}</a><small>{customer.phone}</small></td><td>{customer.location}</td><td>{customer.orderCount}</td><td>{peso.format(customer.totalSpent)}</td><td>{date.format(new Date(customer.latestOrderAt))}</td><td><a className="customer-view-link" href={`#customers/${customer.id}`}>View</a></td></tr>
  ))}</tbody></table></div>;
}

function readSelectedCustomerId(): string | null {
  return window.location.hash.match(/^#customers\/([^/]+)$/)?.[1] ?? null;
}
