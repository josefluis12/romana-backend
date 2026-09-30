import type { Order } from "../types/order";
import type { BaguioClient } from "../types/channel-sale";

export interface CustomerSummary {
  id: string;
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  latestOrderAt: string;
  location: string;
}

export interface RegionSummary {
  name: string;
  orderCount: number;
  revenue: number;
}

export interface CustomerChannelSummary {
  total: number;
  online: number;
  baguio: number;
  multipleChannels: number;
}

export function summarizeCustomerChannels(
  directory: BaguioClient[],
  onlineCustomers: BaguioClient[],
  baguioCustomers: BaguioClient[],
): CustomerChannelSummary {
  const onlineIds = new Set(onlineCustomers.map((customer) => customer.id));
  const baguioIds = new Set(baguioCustomers.map((customer) => customer.id));
  return {
    total: directory.length,
    online: onlineIds.size,
    baguio: baguioIds.size,
    multipleChannels: [...onlineIds].filter((id) => baguioIds.has(id)).length,
  };
}

export function summarizeCustomers(orders: Order[]): CustomerSummary[] {
  const customers = new Map<string, CustomerSummary>();
  for (const order of orders) {
    const key = order.customer.id;
    const current = customers.get(key);
    const latest = !current || order.createdAt > current.latestOrderAt;
    customers.set(key, {
      id: order.customer.id,
      email: order.customer.email,
      name: latest ? fullName(order) : current.name,
      phone: latest ? order.customer.phone : current.phone,
      orderCount: (current?.orderCount ?? 0) + 1,
      totalSpent: (current?.totalSpent ?? 0) + order.total,
      latestOrderAt: latest ? order.createdAt : current.latestOrderAt,
      location: latest ? locationName(order) : current.location,
    });
  }
  return [...customers.values()].sort((left, right) => right.latestOrderAt.localeCompare(left.latestOrderAt));
}

export function mergeCustomerDirectory(directory: BaguioClient[], orders: Order[]): CustomerSummary[] {
  const orderCustomers = new Map(summarizeCustomers(orders).map((customer) => [customer.id, customer]));
  const customers = directory.map((customer): CustomerSummary => orderCustomers.get(customer.id) ?? ({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    orderCount: 0,
    totalSpent: 0,
    latestOrderAt: customer.createdAt,
    location: customer.address || "No address recorded",
  }));
  const directoryIds = new Set(directory.map((customer) => customer.id));
  customers.push(...[...orderCustomers.values()].filter((customer) => !directoryIds.has(customer.id)));
  return customers.sort((left, right) => right.latestOrderAt.localeCompare(left.latestOrderAt));
}

export function summarizeRegions(orders: Order[]): RegionSummary[] {
  const regions = new Map<string, { orders: number; revenue: number }>();
  for (const order of orders) {
    const name = cleanRegionName(order.shippingAddress.region);
    const current = regions.get(name) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.total;
    regions.set(name, current);
  }
  return [...regions].map(([name, value]) => ({
    name,
    orderCount: value.orders,
    revenue: value.revenue,
  })).sort((left, right) => right.orderCount - left.orderCount || left.name.localeCompare(right.name));
}

function cleanRegionName(value: string): string {
  const name = value.trim().replace(/^Region\s+/i, "Region ");
  return name || "Unspecified region";
}

function fullName(order: Order): string {
  return `${order.customer.firstName} ${order.customer.lastName}`.trim();
}

function locationName(order: Order): string {
  const { locality, province, region } = order.shippingAddress;
  return [locality, province, region].filter(Boolean).join(", ");
}
