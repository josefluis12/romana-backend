import type { Order, OrderStatus } from "../../../types/order";

export type StatisticsRange = 30 | 90 | 365 | "all";

export interface TrendPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface ProductPerformance {
  title: string;
  units: number;
  revenue: number;
}

export interface StatisticsSummary {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  unitsSold: number;
  customerCount: number;
  trend: TrendPoint[];
  products: ProductPerformance[];
  statuses: Array<{ status: OrderStatus; count: number }>;
}

const DAY = 86_400_000;
const BUCKET_COUNT = 10;
const revenueStatuses = new Set<OrderStatus>(["paid", "processing", "shipped", "completed"]);

export function summarizeStatistics(
  orders: Order[],
  range: StatisticsRange,
  now = new Date(),
): StatisticsSummary {
  const end = now.getTime();
  const earliest = orders.reduce(
    (minimum, order) => Math.min(minimum, new Date(order.paidAt).getTime()),
    end,
  );
  const start = range === "all" ? earliest : end - (range * DAY);
  const selectedOrders = orders.filter((order) => {
    const paidAt = new Date(order.paidAt).getTime();
    return paidAt >= start && paidAt <= end;
  });
  const revenueOrders = selectedOrders.filter((order) => revenueStatuses.has(order.status));
  const revenue = revenueOrders.reduce((sum, order) => sum + order.total, 0);
  const unitsSold = revenueOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return {
    revenue,
    orderCount: selectedOrders.length,
    averageOrderValue: revenueOrders.length ? revenue / revenueOrders.length : 0,
    unitsSold,
    customerCount: new Set(selectedOrders.map((order) => order.customer.id)).size,
    trend: buildTrend(revenueOrders, start, end),
    products: summarizeProducts(revenueOrders),
    statuses: summarizeStatuses(selectedOrders),
  };
}

function buildTrend(orders: Order[], start: number, end: number): TrendPoint[] {
  const duration = Math.max(end - start, DAY);
  const bucketCount = Math.min(BUCKET_COUNT, Math.max(1, Math.ceil(duration / DAY)));
  const bucketDuration = duration / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: formatBucketLabel(start + (index * bucketDuration), duration),
    revenue: 0,
    orders: 0,
  }));

  for (const order of orders) {
    const paidAt = new Date(order.paidAt).getTime();
    const index = Math.min(Math.floor((paidAt - start) / bucketDuration), bucketCount - 1);
    if (index < 0) continue;
    buckets[index].revenue += order.total;
    buckets[index].orders += 1;
  }
  return buckets;
}

function summarizeProducts(orders: Order[]): ProductPerformance[] {
  const products = new Map<string, ProductPerformance>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = products.get(item.productTitle) ?? {
        title: item.productTitle,
        units: 0,
        revenue: 0,
      };
      current.units += item.quantity;
      current.revenue += item.lineTotal;
      products.set(item.productTitle, current);
    }
  }
  return [...products.values()]
    .sort((left, right) => right.revenue - left.revenue || left.title.localeCompare(right.title))
    .slice(0, 5);
}

function summarizeStatuses(orders: Order[]): StatisticsSummary["statuses"] {
  const counts = new Map<OrderStatus, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count);
}

function formatBucketLabel(timestamp: number, duration: number): string {
  const options: Intl.DateTimeFormatOptions = duration > 120 * DAY
    ? { month: "short", year: "2-digit" }
    : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-PH", options).format(new Date(timestamp));
}
