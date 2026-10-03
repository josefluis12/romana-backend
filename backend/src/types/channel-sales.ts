export type ChannelSaleStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "successful"
  | "cancelled";

export type DeliveryOrderStatus = "draft" | "ready_for_signature" | "approved" | "dispatched" | "cancelled";
export type DeliveryReceiptStatus = "pending" | "issued" | "cancelled";

export interface ChannelSaleItemInput {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
}

export interface BaguioSaleInput {
  customerId: string;
  customerAddressId: string;
  dispatchId: string;
  deliveryNotes: string;
  items: ChannelSaleItemInput[];
}

export interface BaguioSaleUpdateInput {
  deliveryNotes: string;
  items: ChannelSaleItemInput[];
}

export interface ChannelSaleItem extends ChannelSaleItemInput {
  productTitle: string;
  variantLabel: string;
  lineTotal: number;
}

export interface BaguioSale {
  id: string;
  referenceNumber: string;
  status: ChannelSaleStatus;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  customerAddressId: string | null;
  customerId: string;
  dispatchId: string;
  addedAfterDeparture: boolean;
  revisionCount: number;
  deliveryNotes: string;
  van: InventoryLocation;
  total: number;
  createdAt: string;
  deliveryOrder: {
    number: string;
    status: DeliveryOrderStatus;
    preparedByName: string;
  };
  deliveryReceipt: {
    number: string;
    status: DeliveryReceiptStatus;
    clientAcknowledgedAt: string | null;
    proof: SavedDriverDeliveryProof | null;
  };
  items: ChannelSaleItem[];
}

export type BaguioDispatchStatus = "preparing" | "ready_for_departure" | "in_transit" | "completed" | "cancelled";
export type BaguioDispatchAction = "start" | "complete";

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
  collectedAmount: number;
}

export interface SavedDriverDeliveryProof extends Omit<DriverDeliveryProof, "paymentMode" | "collectedAmount"> {
  signedAt: string;
  driverUserId: string;
  paymentMode: PaymentMode | null;
  collectedAmount: number | null;
}

export interface BaguioDispatchInput {
  vanLocationId: string;
  driverUserId: string;
  notes: string;
}

export interface DispatchDriver {
  userId: string;
  name: string;
  email: string;
}

export interface BaguioDispatch extends Omit<BaguioDispatchInput, "driverUserId"> {
  id: string;
  referenceNumber: string;
  status: BaguioDispatchStatus;
  van: InventoryLocation;
  createdAt: string;
  departedAt: string | null;
  driver: DispatchDriver | null;
  orders: BaguioSale[];
  originalAllocation: BaguioAllocationEntry[];
  reconciliation: DispatchReconciliation | null;
}

export type ReconciliationOrderOutcome = "delivered" | "failed";

export interface DispatchReconciliationInput {
  orders: Array<{
    orderId: string;
    outcome: ReconciliationOrderOutcome;
    failureReason: string;
  }>;
  exceptions: Array<{
    productVariantId: string;
    damagedQuantity: number;
    missingQuantity: number;
    notes: string;
  }>;
  notes: string;
}

export interface DispatchReconciliation {
  submittedAt: string;
  totalCollected: number;
  notes: string;
  orders: Array<DispatchReconciliationInput["orders"][number] & { collectedAmount: number }>;
  inventory: Array<{
    productVariantId: string;
    productTitle: string;
    variantLabel: string;
    allocatedQuantity: number;
    deliveredQuantity: number;
    returnedQuantity: number;
    damagedQuantity: number;
    missingQuantity: number;
    remainingQuantity: number;
    notes: string;
  }>;
}

export interface BaguioAllocationEntry {
  orderId: string;
  orderReferenceNumber: string;
  clientName: string;
  productVariantId: string;
  productTitle: string;
  variantLabel: string;
  quantity: number;
}

export interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  type: "factory" | "vehicle";
}

export interface BaguioClientInput {
  name: string;
  address: ShippingAddress;
  phone: string;
  email: string;
  contactPerson: string;
}

export interface CustomerAddressInput {
  label: string;
  address: ShippingAddress;
}

export interface CustomerAddress extends CustomerAddressInput {
  id: string;
  formattedAddress: string;
  isDefault: boolean;
}

export interface BaguioClient extends Omit<BaguioClientInput, "address"> {
  id: string;
  referenceNumber: string;
  address: string;
  structuredAddress: ShippingAddress | null;
  addresses: CustomerAddress[];
  isActive: boolean;
  createdAt: string;
}

export type BaguioSaleAction = "submit" | "approve" | "load" | "deliver" | "complete";
import type { ShippingAddress } from "./order.js";
