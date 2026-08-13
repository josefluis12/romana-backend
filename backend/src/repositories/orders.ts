import type { PendingCheckout } from "../types/order.js";

export interface OrderRepository {
  createPending(checkout: PendingCheckout): Promise<void>;
  attachMayaCheckout(requestReferenceNumber: string, checkoutId: string): Promise<void>;
  completePaidCheckout(paymentId: string): Promise<{ orderId: string; created: boolean } | null>;
}

function headers(key: string, prefer?: string): Record<string, string> {
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function assertConfigured(url: string, key: string): void {
  if (!url || !key) throw new Error("Order storage is not configured.");
}

export function createSupabaseOrderRepository(url: string, secretKey: string): OrderRepository {
  return {
    async createPending(checkout) {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/storefront_checkout_sessions`, {
        method: "POST",
        headers: headers(secretKey),
        body: JSON.stringify({
          request_reference_number: checkout.requestReferenceNumber,
          customer: checkout.customer,
          shipping_address: checkout.shippingAddress,
          delivery_notes: checkout.deliveryNotes,
          items: checkout.items,
          total: checkout.total,
        }),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
    },
    async attachMayaCheckout(requestReferenceNumber, checkoutId) {
      assertConfigured(url, secretKey);
      const filter = encodeURIComponent(`eq.${requestReferenceNumber}`);
      const response = await fetch(`${url}/rest/v1/storefront_checkout_sessions?request_reference_number=${filter}`, {
        method: "PATCH",
        headers: headers(secretKey, "return=minimal"),
        body: JSON.stringify({ maya_checkout_id: checkoutId, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
    },
    async completePaidCheckout(paymentId) {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/rpc/complete_paid_storefront_checkout`, {
        method: "POST",
        headers: headers(secretKey),
        body: JSON.stringify({ payment_id: paymentId }),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (value === null) return null;
      if (typeof value !== "object" || Array.isArray(value)) throw new Error("Order storage returned invalid data.");
      const orderId = Reflect.get(value, "orderId");
      const created = Reflect.get(value, "created");
      if (typeof orderId !== "string" || typeof created !== "boolean") throw new Error("Order storage returned invalid data.");
      return { orderId, created };
    },
  };
}
