import assert from "node:assert/strict";
import test from "node:test";
import { summarizeStatistics } from "../src/app/(dashboard)/statistics/statistics.ts";
import type { Order, OrderStatus } from "../src/types/order.ts";

const now = new Date("2026-08-25T12:00:00.000Z");

test("summarizes revenue, units, customers, products, and statuses", () => {
  const orders = [
    makeOrder({ id: "order-1", total: 640, status: "completed", customerId: "customer-1", quantity: 2 }),
    makeOrder({ id: "order-2", total: 320, status: "processing", customerId: "customer-1", quantity: 1 }),
    makeOrder({ id: "order-3", total: 200, status: "refunded", customerId: "customer-2", quantity: 1 }),
  ];

  const summary = summarizeStatistics(orders, 30, now);

  assert.equal(summary.revenue, 960);
  assert.equal(summary.orderCount, 3);
  assert.equal(summary.averageOrderValue, 480);
  assert.equal(summary.unitsSold, 3);
  assert.equal(summary.customerCount, 2);
  assert.deepEqual(summary.products, [{ title: "Peanut Brittle", units: 3, revenue: 960 }]);
  assert.deepEqual(summary.statuses, [
    { status: "completed", count: 1 },
    { status: "processing", count: 1 },
    { status: "refunded", count: 1 },
  ]);
});

test("filters orders outside the selected date range", () => {
  const recent = makeOrder({ id: "recent", paidAt: "2026-08-20T00:00:00.000Z" });
  const old = makeOrder({ id: "old", paidAt: "2026-06-01T00:00:00.000Z" });

  const thirtyDays = summarizeStatistics([recent, old], 30, now);
  const allAvailable = summarizeStatistics([recent, old], "all", now);

  assert.equal(thirtyDays.orderCount, 1);
  assert.equal(allAvailable.orderCount, 2);
  assert.equal(allAvailable.trend.reduce((sum, point) => sum + point.orders, 0), 2);
});

function makeOrder({
  id,
  total = 320,
  status = "paid",
  customerId = "customer-1",
  quantity = 1,
  paidAt = "2026-08-20T00:00:00.000Z",
}: {
  id: string;
  total?: number;
  status?: OrderStatus;
  customerId?: string;
  quantity?: number;
  paidAt?: string;
}): Order {
  return {
    id,
    referenceNumber: `reference-${id}`,
    paymentId: `payment-${id}`,
    status,
    total,
    currency: "PHP",
    paidAt,
    createdAt: paidAt,
    customer: { id: customerId, email: "shopper@example.com", firstName: "Ada", lastName: "Lovelace", phone: "+639123456789" },
    shippingAddress: { street: "1 Main Street", region: "Metro Manila", province: "", locality: "Manila", district: "Tondo", barangay: "Barangay 1", postalCode: "1000", country: "Philippines" },
    deliveryNotes: "",
    items: [{ productSlug: "peanut-brittle", productTitle: "Peanut Brittle", variantLabel: "250g", quantity, unitPrice: total / quantity, lineTotal: total }],
    activity: [],
    shipment: null,
  };
}
