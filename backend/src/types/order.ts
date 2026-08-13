export interface CheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
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
