import { useEffect, useMemo, useState } from "react";
import { BarChart3, PackageOpen, RefreshCw, TrendingUp } from "lucide-react";
import { listOrders } from "../../../services/orders";
import type { Order, OrderStatus } from "../../../types/order";
import { summarizeStatistics, type StatisticsRange } from "./statistics";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function StatisticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [range, setRange] = useState<StatisticsRange>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOrders(await listOrders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load statistics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => summarizeStatistics(orders, range), [orders, range]);

  if (loading) return <div className="catalog-status" role="status">Loading statistics…</div>;

  return (
    <section className="mt-9 min-[801px]:mt-[38px]">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-[18px] min-[620px]:flex-row min-[620px]:items-end min-[620px]:justify-between">
        <p className="m-0 max-w-xl text-sm leading-6 text-[var(--muted)]">
          Sales performance from the latest {orders.length} order{orders.length === 1 ? "" : "s"} available to the admin portal.
        </p>
        <div className="flex items-end gap-2">
          <label className="grid gap-1.5 text-xs font-bold text-[#4b4944]">
            Date range
            <select
              className="h-10 rounded-[5px] border border-[#cbc7bd] bg-white px-3 outline-none focus:border-[var(--red)] focus:ring-3 focus:ring-red-700/10"
              value={range}
              onChange={(event) => setRange(readRange(event.target.value))}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="all">All available</option>
            </select>
          </label>
          <button className="secondary-button" type="button" onClick={() => void load()} title="Refresh statistics" aria-label="Refresh statistics">
            <RefreshCw />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <section className="mt-5 grid border border-[var(--line)] bg-white sm:grid-cols-2 xl:grid-cols-4" aria-label="Sales statistics">
        <Metric label="Sales" value={peso.format(summary.revenue)} detail={`${summary.orderCount} orders in range`} />
        <Metric label="Average order" value={peso.format(summary.averageOrderValue)} detail="Excludes cancelled and refunded" />
        <Metric label="Units sold" value={String(summary.unitsSold)} detail="Across revenue-generating orders" />
        <Metric label="Customers" value={String(summary.customerCount)} detail="Unique shoppers in range" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]">
        <section className="min-w-0 border border-[var(--line)] bg-white p-5 sm:p-6">
          <CardHeading icon={<TrendingUp />} title="Sales trend" detail="Revenue over the selected date range" />
          <SalesChart trend={summary.trend} />
        </section>
        <section className="min-w-0 border border-[var(--line)] bg-white p-5 sm:p-6">
          <CardHeading icon={<BarChart3 />} title="Order status" detail="Current fulfillment mix" />
          <StatusBreakdown statuses={summary.statuses} total={summary.orderCount} />
        </section>
      </div>

      <section className="mt-5 border border-[var(--line)] bg-white">
        <div className="p-5 sm:p-6">
          <CardHeading icon={<PackageOpen />} title="Top products" detail="Ranked by sales in the selected range" />
        </div>
        <ProductTable products={summary.products} />
      </section>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="grid min-w-0 border-[var(--line)] p-5 [&:not(:first-child)]:border-t sm:[&:nth-child(even)]:border-l xl:[&:not(:first-child)]:border-l xl:[&:not(:first-child)]:border-t-0">
      <span className="text-[11px] font-extrabold uppercase text-[var(--muted)]">{label}</span>
      <strong className="mt-2 overflow-hidden text-ellipsis font-serif text-3xl font-normal">{value}</strong>
      <small className="mt-1 text-[11px] text-[#99958d]">{detail}</small>
    </article>
  );
}

function CardHeading({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-[var(--line)] pb-[18px]">
      <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-[#fae9e8] text-[var(--red)] [&>svg]:size-[18px]">{icon}</span>
      <div><h2 className="m-0 font-serif text-[23px] font-normal">{title}</h2><p className="mt-1 mb-0 text-xs text-[var(--muted)]">{detail}</p></div>
    </header>
  );
}

function SalesChart({ trend }: { trend: ReturnType<typeof summarizeStatistics>["trend"] }) {
  const maximum = Math.max(...trend.map((point) => point.revenue), 1);
  const hasRevenue = trend.some((point) => point.revenue > 0);
  if (!hasRevenue) return <div className="grid min-h-[260px] place-items-center text-sm text-[var(--muted)]">No sales in this date range.</div>;
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex min-w-[560px] items-end gap-2" role="img" aria-label="Sales trend bar chart">
        {trend.map((point, index) => (
          <div className="grid flex-1 gap-2 text-center" key={`${point.label}-${index}`}>
            <span className="text-[10px] font-bold text-[#4b4944]">{point.revenue ? peso.format(point.revenue) : ""}</span>
            <svg className="!h-44 !w-full" viewBox="0 0 40 160" preserveAspectRatio="none" aria-hidden="true">
              <rect x="4" y="0" width="32" height="160" rx="2" fill="#f1eee6" />
              <rect x="4" y={160 - Math.max((point.revenue / maximum) * 160, point.revenue ? 4 : 0)} width="32" height={Math.max((point.revenue / maximum) * 160, point.revenue ? 4 : 0)} rx="2" fill="#c82028" />
            </svg>
            <span className="text-[10px] text-[var(--muted)]">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBreakdown({ statuses, total }: { statuses: Array<{ status: OrderStatus; count: number }>; total: number }) {
  if (!statuses.length) return <div className="grid min-h-[260px] place-items-center text-sm text-[var(--muted)]">No orders in this date range.</div>;
  return <div className="mt-6 grid gap-5">{statuses.map(({ status, count }) => (
    <div className="grid gap-2" key={status}>
      <div className="flex items-center justify-between gap-4 text-xs"><strong>{statusLabel(status)}</strong><span className="text-[var(--muted)]">{count} · {Math.round((count / total) * 100)}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eeeae1]" aria-hidden="true">
        <span className="block h-full rounded-full bg-[var(--red)]" style={{ width: `${(count / total) * 100}%` }} />
      </div>
    </div>
  ))}</div>;
}

function ProductTable({ products }: { products: ReturnType<typeof summarizeStatistics>["products"] }) {
  if (!products.length) return <div className="border-t border-[var(--line)] p-12 text-center text-sm text-[var(--muted)]">No product sales in this date range.</div>;
  return (
    <div className="overflow-x-auto border-t border-[var(--line)]">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead><tr className="bg-[#f8f7f3] text-[10px] uppercase text-[var(--muted)]"><th className="px-5 py-3">Product</th><th className="px-5 py-3">Units sold</th><th className="px-5 py-3 text-right">Sales</th></tr></thead>
        <tbody>{products.map((product, index) => <tr className="border-t border-[var(--line)]" key={product.title}><td className="px-5 py-4"><span className="mr-3 text-[var(--red)]">{index + 1}</span><strong>{product.title}</strong></td><td className="px-5 py-4">{product.units}</td><td className="px-5 py-4 text-right font-bold">{peso.format(product.revenue)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function readRange(value: string): StatisticsRange {
  if (value === "all") return "all";
  const parsed = Number(value);
  return parsed === 90 || parsed === 365 ? parsed : 30;
}

function statusLabel(status: OrderStatus): string {
  return status === "completed" ? "Delivered" : status[0].toUpperCase() + status.slice(1);
}
