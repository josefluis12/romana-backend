export interface CheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface AdminCustomer extends CheckoutCustomer {
  id: string;
}

export interface ShippingAddress {
  street: string;
  region: string;
  province: string;
  locality: string;
  district: string;
  barangay: string;
  postalCode: string;
  country: "Philippines";
}

export interface CheckoutDetails {
  customer: CheckoutCustomer;
  shippingAddress: ShippingAddress;
  deliveryNotes: string;
}

export interface PendingOrderItem {
  productSlug: string;
  productTitle: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
}

export interface PendingCheckout extends CheckoutDetails {
  requestReferenceNumber: string;
  items: PendingOrderItem[];
  total: number;
}

export type OrderStatus = "paid" | "processing" | "shipped" | "completed" | "cancelled" | "refunded";

export interface AdminOrderItem extends PendingOrderItem {
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

export interface AdminOrder extends Omit<CheckoutDetails, "customer"> {
  id: string;
  referenceNumber: string;
  paymentId: string;
  status: OrderStatus;
  total: number;
  currency: "PHP";
  paidAt: string;
  createdAt: string;
  items: AdminOrderItem[];
  activity: OrderActivity[];
  shipment: ShipmentDetails | null;
  customer: AdminCustomer;
}
