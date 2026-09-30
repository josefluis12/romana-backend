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
  };
  items: ChannelSaleItem[];
}

export type BaguioDispatchStatus = "preparing" | "in_transit" | "completed" | "cancelled";
export type BaguioDispatchAction = "start" | "complete";

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

export interface BaguioClient extends Omit<BaguioClientInput, "address"> {
  id: string;
  referenceNumber: string;
  address: string;
  structuredAddress: ShippingAddress | null;
  isActive: boolean;
  createdAt: string;
}

export type BaguioSaleAction = "submit" | "approve" | "load" | "deliver" | "complete";
import type { ShippingAddress } from "./order.js";
