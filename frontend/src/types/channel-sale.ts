export type ChannelSaleStatus = "draft" | "pending_approval" | "approved" | "loaded" | "in_transit" | "delivered" | "successful" | "cancelled";
export type BaguioSaleAction = "submit" | "approve" | "load" | "deliver" | "complete";

export interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  type: "factory" | "vehicle";
}

export interface BaguioSaleInput {
  customerId: string;
  dispatchId: string;
  deliveryNotes: string;
  items: Array<{ productVariantId: string; quantity: number; unitPrice: number }>;
}

export interface BaguioSaleUpdateInput {
  deliveryNotes: string;
  items: BaguioSaleInput["items"];
}

export interface BaguioSale extends Omit<BaguioSaleInput, "dispatchId" | "items"> {
  id: string;
  referenceNumber: string;
  status: ChannelSaleStatus;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  dispatchId: string;
  addedAfterDeparture: boolean;
  revisionCount: number;
  van: InventoryLocation;
  total: number;
  createdAt: string;
  deliveryOrder: {
    number: string;
    status: "draft" | "ready_for_signature" | "approved" | "dispatched" | "cancelled";
    preparedByName: string;
  };
  deliveryReceipt: {
    number: string;
    status: "pending" | "issued" | "cancelled";
    clientAcknowledgedAt: string | null;
  };
  items: Array<{
    productVariantId: string;
    productTitle: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export type BaguioDispatchStatus = "preparing" | "in_transit" | "completed" | "cancelled";
export type BaguioDispatchAction = "start" | "complete";

export interface BaguioDispatchInput { vanLocationId: string; driverUserId: string; notes: string }

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

export interface BaguioClientInput {
  name: string;
  address: PhilippineAddress;
  phone: string;
  email: string;
  contactPerson: string;
}

export interface BaguioClient extends Omit<BaguioClientInput, "address"> {
  id: string;
  referenceNumber: string;
  address: string;
  structuredAddress: PhilippineAddress | null;
  isActive: boolean;
  createdAt: string;
}
export interface PhilippineAddress {
  street: string;
  region: string;
  province: string;
  locality: string;
  district: string;
  barangay: string;
  postalCode: string;
  country: "Philippines";
}
