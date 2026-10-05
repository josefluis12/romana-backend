import type { AdminOrder, OrderStatus, PendingCheckout, ShipmentInput } from "../types/order.js";

export interface OrderRepository {
  createPending(checkout: PendingCheckout): Promise<void>;
  attachMayaCheckout(requestReferenceNumber: string, checkoutId: string): Promise<void>;
  completePaidCheckout(paymentId: string): Promise<{ orderId: string; created: boolean } | null>;
  list(): Promise<AdminOrder[]>;
  listByCustomer(customerId: string, limit: number, offset: number): Promise<AdminOrder[]>;
  listPendingPaymentIds(): Promise<string[]>;
  startPreparing(orderId: string, actor: OrderActor): Promise<boolean>;
  ship(orderId: string, shipment: ShipmentInput, actor: OrderActor): Promise<boolean>;
}

export interface OrderActor {
  userId: string;
  email: string | null;
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

const orderSelect = "id,request_reference_number,maya_payment_id,status,total,currency,shipping_address,delivery_notes,paid_at,created_at,shipping_carrier,tracking_number,dispatch_note,dispatched_at,customer_email,customer_first_name,customer_last_name,customer_phone,customers(id),order_items(product_slug,product_title,variant_label,quantity,unit_price,line_total),order_status_events(status,created_at,actor_user_id,actor_email,metadata)";

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
    async list() {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&order=created_at.desc&limit=100`, {
        headers: headers(secretKey),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Order storage returned invalid data.");
      return value.map(readAdminOrder);
    },
    async listByCustomer(customerId, limit, offset) {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/orders?select=${encodeURIComponent(orderSelect)}&customer_id=eq.${customerId}&order=created_at.desc&limit=${limit}&offset=${offset}`, {
        headers: headers(secretKey),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Order storage returned invalid data.");
      return value.map(readAdminOrder);
    },
    async listPendingPaymentIds() {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/storefront_checkout_sessions?select=maya_checkout_id&completed_at=is.null&maya_checkout_id=not.is.null&order=created_at.desc&limit=50`, {
        headers: headers(secretKey),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Order storage returned invalid data.");
      return value.map((row) => {
        if (!isRecord(row)) throw new Error("Order storage returned invalid data.");
        return readString(row.maya_checkout_id);
      });
    },
    async startPreparing(orderId, actor) {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/rpc/start_preparing_order`, {
        method: "POST",
        headers: headers(secretKey),
        body: JSON.stringify({
          target_order_id: orderId,
          performed_by_user_id: actor.userId,
          performed_by_email: actor.email,
        }),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (typeof value !== "boolean") throw new Error("Order storage returned invalid data.");
      return value;
    },
    async ship(orderId, shipment, actor) {
      assertConfigured(url, secretKey);
      const response = await fetch(`${url}/rest/v1/rpc/ship_order`, {
        method: "POST",
        headers: headers(secretKey),
        body: JSON.stringify({
          target_order_id: orderId,
          performed_by_user_id: actor.userId,
          performed_by_email: actor.email,
          carrier_name: shipment.carrier,
          shipment_tracking_number: shipment.trackingNumber,
          shipment_dispatch_note: shipment.dispatchNote,
        }),
      });
      if (!response.ok) throw new Error("Order storage request failed.");
      const value: unknown = await response.json();
      if (typeof value !== "boolean") throw new Error("Order storage returned invalid data.");
      return value;
    },
  };
}

function readAdminOrder(value: unknown): AdminOrder {
  if (!isRecord(value) || !isRecord(value.customers) || !isRecord(value.shipping_address) || !Array.isArray(value.order_items) || !Array.isArray(value.order_status_events)) {
    throw new Error("Order storage returned invalid data.");
  }
  const customer = value.customers;
  const address = value.shipping_address;
  return {
    id: readString(value.id), referenceNumber: readString(value.request_reference_number), paymentId: readString(value.maya_payment_id),
    status: readOrderStatus(value.status), total: readNumber(value.total), currency: "PHP",
    paidAt: readString(value.paid_at), createdAt: readString(value.created_at), deliveryNotes: readString(value.delivery_notes),
    customer: {
      id: readString(customer.id),
      email: readString(value.customer_email),
      firstName: readString(value.customer_first_name),
      lastName: readString(value.customer_last_name),
      phone: readString(value.customer_phone),
    },
    shippingAddress: {
      street: readString(address.street), region: readString(address.region), province: readString(address.province),
      locality: readString(address.locality), district: readString(address.district), barangay: readString(address.barangay),
      postalCode: readString(address.postalCode), country: "Philippines",
      location: readOptionalDeliveryLocation(address.location),
    },
    items: value.order_items.map((item) => {
      if (!isRecord(item)) throw new Error("Order storage returned invalid data.");
      return { productSlug: readString(item.product_slug), productTitle: readString(item.product_title), variantLabel: readString(item.variant_label), quantity: readNumber(item.quantity), unitPrice: readNumber(item.unit_price), lineTotal: readNumber(item.line_total) };
    }),
    activity: value.order_status_events.map((event) => {
      if (!isRecord(event)) throw new Error("Order storage returned invalid data.");
      return {
        status: readOrderStatus(event.status),
        createdAt: readString(event.created_at),
        actorUserId: readNullableString(event.actor_user_id),
        actorEmail: readNullableString(event.actor_email),
        shipment: readEventShipment(event.metadata),
      };
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    shipment: readOrderShipment(value),
  };
}

function readOptionalDeliveryLocation(value: unknown): AdminOrder["shippingAddress"]["location"] {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error("Order storage returned invalid data.");
  return {
    placeId: readString(value.placeId),
    latitude: readNumber(value.latitude),
    longitude: readNumber(value.longitude),
  };
}

function readOrderShipment(value: Record<string, unknown>): AdminOrder["shipment"] {
  const carrier = readNullableString(value.shipping_carrier);
  const trackingNumber = readNullableString(value.tracking_number);
  if (!carrier || !trackingNumber) return null;
  return {
    carrier,
    trackingNumber,
    dispatchNote: readString(value.dispatch_note),
    dispatchedAt: readNullableString(value.dispatched_at),
  };
}

function readEventShipment(value: unknown): AdminOrder["shipment"] {
  if (!isRecord(value)) return null;
  if (typeof value.carrier !== "string" || typeof value.trackingNumber !== "string") return null;
  return {
    carrier: value.carrier,
    trackingNumber: value.trackingNumber,
    dispatchNote: typeof value.dispatchNote === "string" ? value.dispatchNote : "",
    dispatchedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Order storage returned invalid data.");
  return value;
}

function readNullableString(value: unknown): string | null {
  if (value === null) return null;
  return readString(value);
}

function readNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Order storage returned invalid data.");
  return parsed;
}

function readOrderStatus(value: unknown): OrderStatus {
  if (typeof value !== "string" || !["paid", "processing", "shipped", "completed", "cancelled", "refunded"].includes(value)) {
    throw new Error("Order storage returned invalid data.");
  }
  return value as OrderStatus;
}
