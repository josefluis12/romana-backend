export type OrderStatus = "paid" | "processing" | "shipped" | "completed" | "cancelled" | "refunded";

export interface OrderItem {
  productSlug: string;
  productTitle: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderActivity {
  status: OrderStatus;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  shipment: ShipmentDetails | null;
}

export interface ShipmentInput {
  carrier: string;
  trackingNumber: string;
  dispatchNote: string;
}

export interface ShipmentDetails extends ShipmentInput {
  dispatchedAt: string | null;
}

export interface Order {
  id: string;
  referenceNumber: string;
  paymentId: string;
  status: OrderStatus;
  total: number;
  currency: "PHP";
  paidAt: string;
  createdAt: string;
  customer: { id: string; email: string; firstName: string; lastName: string; phone: string };
  shippingAddress: {
    street: string;
    region: string;
    province: string;
    locality: string;
    district: string;
    barangay: string;
    postalCode: string;
    country: "Philippines";
  };
  deliveryNotes: string;
  items: OrderItem[];
  activity: OrderActivity[];
  shipment: ShipmentDetails | null;
}
