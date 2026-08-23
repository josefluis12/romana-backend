import type { Order, ShipmentInput } from "../types/order";

interface OrdersResponse {
  orders: Order[];
  error?: string;
}

export async function listOrders(): Promise<Order[]> {
  const response = await fetch("/api/orders", { credentials: "include" });
  const result = await readJson<OrdersResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load orders.");
  return result.orders;
}

export async function listCustomerOrders(customerId: string): Promise<Order[]> {
  const orders: Order[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const response: Response = await fetch(`/api/customers/${customerId}/orders?offset=${offset}`, { credentials: "include" });
    const result: OrdersResponse & { nextOffset: number | null } = await readJson(response);
    if (!response.ok) throw new Error(result.error || "Unable to load the customer's orders.");
    orders.push(...result.orders);
    offset = result.nextOffset;
  }
  return orders;
}

export async function startPreparingOrder(id: string, csrfToken: string): Promise<void> {
  const response = await fetch(`/api/orders/${id}/start-preparing`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  const result = await readJson<{ error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to start preparing the order.");
}

export async function shipOrder(id: string, shipment: ShipmentInput, csrfToken: string): Promise<void> {
  const response = await fetch(`/api/orders/${id}/ship`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(shipment),
  });
  const result = await readJson<{ error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to mark the order as shipped.");
}

export async function reconcileOrders(csrfToken: string): Promise<number> {
  const response = await fetch("/api/orders/reconcile", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  const result = await readJson<{ completed?: number; error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to synchronize payments.");
  return result.completed ?? 0;
}

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}
