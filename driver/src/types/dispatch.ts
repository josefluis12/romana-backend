export type DriverDispatchStatus = "preparing" | "in_transit" | "completed" | "cancelled";

export interface DriverOrder {
  id: string;
  referenceNumber: string;
  status: string;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  total: number;
  items: DriverOrderItem[];
}

export interface DriverOrderItem {
  productVariantId: string;
  productTitle: string;
  variantLabel: string;
  quantity: number;
}

export interface SignaturePoint {
  x: number;
  y: number;
}

export type PaymentMode = "cash" | "gcash" | "maya" | "bank_transfer" | "cheque";

export interface DriverDeliveryProof {
  signature: SignaturePoint[][];
  latitude: number;
  longitude: number;
  accuracy: number;
  paymentMode: PaymentMode;
}

export interface DriverDispatch {
  id: string;
  referenceNumber: string;
  status: DriverDispatchStatus;
  vanName: string;
  createdAt: string;
  departedAt: string | null;
  orders: DriverOrder[];
}

export interface DispatchReconciliationInput {
  orders: {
    orderId: string;
    outcome: "delivered" | "failed";
    collectedAmount: number;
    failureReason: string;
  }[];
  exceptions: {
    productVariantId: string;
    damagedQuantity: number;
    missingQuantity: number;
    notes: string;
  }[];
  notes: string;
}
