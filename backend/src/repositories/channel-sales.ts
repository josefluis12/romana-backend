import type {
  BaguioSale,
  BaguioDispatch,
  BaguioDispatchAction,
  BaguioDispatchInput,
  BaguioSaleAction,
  BaguioSaleInput,
  BaguioSaleUpdateInput,
  BaguioClient,
  BaguioClientInput,
  CustomerAddress,
  CustomerAddressInput,
  ChannelSaleStatus,
  DeliveryOrderStatus,
  DeliveryReceiptStatus,
  DriverDeliveryProof,
  DispatchReconciliationInput,
  InventoryLocation,
} from "../types/channel-sales.js";
import { loadDispatchDriver } from "./dispatch-driver-account.js";
import { completeDriverDelivery } from "./driver-delivery.js";
import { startAssignedDriverTrip } from "./driver-trip.js";
import { loadDispatchReconciliations, reconcileAssignedDriverDispatch } from "./dispatch-reconciliation.js";
import { readBaguioClient, readInventoryLocation } from "./channel-sales-readers.js";
import { customerSelect, saveCustomerAddress } from "./customer-addresses.js";
import { readBaguioDispatch } from "./channel-sales-dispatch-reader.js";
import { readSavedDriverDeliveryProof } from "./delivery-proof.js";

export interface ChannelSaleActor {
  userId: string;
  email: string | null;
  name: string;
}

export interface ChannelSalesRepository {
  listBaguioSales(): Promise<BaguioSale[]>;
  listBaguioDispatches(driverUserId?: string): Promise<BaguioDispatch[]>;
  listVans(): Promise<InventoryLocation[]>;
  listBaguioClients(limit: number, offset: number): Promise<BaguioClient[]>;
  listOnlineClients(limit: number, offset: number): Promise<BaguioClient[]>;
  listCustomers(limit: number, offset: number): Promise<BaguioClient[]>;
  createBaguioClient(input: BaguioClientInput, actor: ChannelSaleActor): Promise<BaguioClient>;
  createCustomerAddress(customerId: string, input: CustomerAddressInput, actor: ChannelSaleActor): Promise<CustomerAddress>;
  createBaguioSale(input: BaguioSaleInput, actor: ChannelSaleActor): Promise<string>;
  updateBaguioSale(id: string, input: BaguioSaleUpdateInput, actor: ChannelSaleActor): Promise<boolean>;
  createBaguioDispatch(input: BaguioDispatchInput, actor: ChannelSaleActor): Promise<string>;
  advanceBaguioDispatch(id: string, action: BaguioDispatchAction, actor: ChannelSaleActor): Promise<boolean>;
  advanceBaguioSale(id: string, action: BaguioSaleAction, actor: ChannelSaleActor): Promise<boolean>;
  completeDriverDelivery(id: string, proof: DriverDeliveryProof, actor: ChannelSaleActor): Promise<boolean>;
  startDriverTrip(id: string, actor: ChannelSaleActor): Promise<boolean>;
  reconcileDriverDispatch(id: string, input: DispatchReconciliationInput, actor: ChannelSaleActor): Promise<boolean>;
}

const saleSelect = "id,reference_number,status,customer_id,customer_address_id,dispatch_id,added_after_departure,client_name,client_address,client_phone,delivery_notes,total,created_at,inventory_locations(id,code,name,type),channel_sale_items(product_variant_id,product_title,variant_label,quantity,unit_price,line_total),channel_sale_revisions(id),delivery_order_forms(document_number,status,prepared_by_name),delivery_receipts(document_number,status,client_acknowledged_at,client_signature,signed_at,signed_latitude,signed_longitude,location_accuracy,signed_by_driver_user_id,payment_mode,collected_amount)";
const dispatchSelect = "id,reference_number,status,van_location_id,driver_user_id,driver_name,driver_email,notes,created_at,departed_at,inventory_locations(id,code,name,type)";
const allocationSelect = "dispatch_id,order_id,order_reference_number,client_name,product_variant_id,product_title,variant_label,quantity";

export function createSupabaseChannelSalesRepository(url: string, secretKey: string): ChannelSalesRepository {
  const requestHeaders = { apikey: secretKey, "Content-Type": "application/json" };
  function assertConfigured(): void {
    if (!url || !secretKey) throw new Error("Channel sales storage is not configured.");
  }

  return {
    async listBaguioSales() {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/channel_sales_orders?select=${encodeURIComponent(saleSelect)}&channel_code=eq.baguio&order=created_at.desc&limit=100`, { headers: requestHeaders });
      if (!response.ok) throw new Error("Channel sales storage request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Channel sales storage returned invalid data.");
      return value.map(readSale);
    },
    async listBaguioDispatches(driverUserId) {
      assertConfigured();
      const driverFilter = driverUserId ? `&driver_user_id=eq.${encodeURIComponent(driverUserId)}` : "";
      const [dispatchResponse, sales, allocations] = await Promise.all([
        fetch(`${url}/rest/v1/baguio_dispatches?select=${encodeURIComponent(dispatchSelect)}${driverFilter}&order=created_at.desc&limit=100`, { headers: requestHeaders }),
        fetch(`${url}/rest/v1/channel_sales_orders?select=${encodeURIComponent(saleSelect)}&channel_code=eq.baguio&order=created_at.desc&limit=100`, { headers: requestHeaders }),
        fetch(`${url}/rest/v1/baguio_dispatch_allocation_snapshots?select=${encodeURIComponent(allocationSelect)}&order=product_title.asc,order_reference_number.asc&limit=5000`, { headers: requestHeaders }),
      ]);
      if (!dispatchResponse.ok || !sales.ok || !allocations.ok) throw new Error("Baguio dispatch storage request failed.");
      const dispatchValue: unknown = await dispatchResponse.json();
      const salesValue: unknown = await sales.json();
      const allocationValue: unknown = await allocations.json();
      if (!Array.isArray(dispatchValue) || !Array.isArray(salesValue) || !Array.isArray(allocationValue)) throw new Error("Baguio dispatch storage returned invalid data.");
      const parsedSales = salesValue.map(readSale);
      const dispatchIds = dispatchValue.map((value) => readRecordId(value));
      const reconciliations = await loadDispatchReconciliations(url, secretKey, dispatchIds);
      return dispatchValue.map((value) => readBaguioDispatch(value, parsedSales, allocationValue, reconciliations));
    },
    async listVans() {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/inventory_locations?select=id,code,name,type&type=eq.vehicle&is_active=eq.true&order=name`, { headers: requestHeaders });
      if (!response.ok) throw new Error("Inventory locations request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Inventory locations returned invalid data.");
      return value.map(readInventoryLocation);
    },
    async listBaguioClients(limit, offset) {
      assertConfigured();
      const select = `${customerSelect},customer_sales_channels!inner(channel_code)`;
      const response = await fetch(`${url}/rest/v1/customers?select=${encodeURIComponent(select)}&customer_sales_channels.channel_code=eq.baguio&order=business_name.asc.nullslast,first_name.asc&limit=${limit}&offset=${offset}`, { headers: requestHeaders });
      if (!response.ok) throw new Error("Baguio client directory request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Baguio client directory returned invalid data.");
      return value.map(readBaguioClient);
    },
    async listOnlineClients(limit, offset) {
      assertConfigured();
      const select = `${customerSelect},customer_sales_channels!inner(channel_code)`;
      const response = await fetch(`${url}/rest/v1/customers?select=${encodeURIComponent(select)}&customer_sales_channels.channel_code=eq.online&order=business_name.asc.nullslast,first_name.asc&limit=${limit}&offset=${offset}`, { headers: requestHeaders });
      if (!response.ok) throw new Error("Online customer directory request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Online customer directory returned invalid data.");
      return value.map(readBaguioClient);
    },
    async listCustomers(limit, offset) {
      assertConfigured();
      const select = customerSelect;
      const response = await fetch(`${url}/rest/v1/customers?select=${encodeURIComponent(select)}&order=business_name.asc.nullslast,first_name.asc&limit=${limit}&offset=${offset}`, { headers: requestHeaders });
      if (!response.ok) throw new Error("Customer directory request failed.");
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Customer directory returned invalid data.");
      return value.map(readBaguioClient);
    },
    async createBaguioClient(input, actor) {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/rpc/register_customer`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ customer_channel_code: "baguio", customer_name: input.name, customer_address: input.address, customer_phone: input.phone, customer_email: input.email, customer_contact_person: input.contactPerson, performed_by_user_id: actor.userId, performed_by_email: actor.email }),
      });
      if (!response.ok) throw new Error("Baguio client directory request failed.");
      const id: unknown = await response.json();
      if (typeof id !== "string") throw new Error("Baguio client directory returned invalid data.");
      const saved = await fetch(`${url}/rest/v1/customers?select=${encodeURIComponent(customerSelect)}&id=eq.${encodeURIComponent(id)}`, { headers: requestHeaders });
      const value: unknown = await saved.json();
      if (!saved.ok || !Array.isArray(value) || !value[0]) throw new Error("Baguio client directory returned invalid data.");
      return readBaguioClient(value[0]);
    },
    async createCustomerAddress(customerId, input, actor) {
      assertConfigured();
      return saveCustomerAddress(url, requestHeaders, customerId, input, actor);
    },
    async createBaguioSale(input, actor) {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/rpc/create_baguio_sale`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          selected_customer_id: input.customerId,
          selected_customer_address_id: input.customerAddressId,
          selected_dispatch_id: input.dispatchId,
          prepared_by_name: actor.name,
          order_notes: input.deliveryNotes,
          item_data: input.items,
          performed_by_user_id: actor.userId,
          performed_by_email: actor.email,
        }),
      });
      if (!response.ok) throw new Error("Channel sales storage request failed.");
      const id: unknown = await response.json();
      if (typeof id !== "string") throw new Error("Channel sales storage returned an invalid identifier.");
      return id;
    },
    async updateBaguioSale(id, input, actor) {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/rpc/revise_baguio_sale`, {
        method: "POST", headers: requestHeaders,
        body: JSON.stringify({ target_order_id: id, order_notes: input.deliveryNotes, item_data: input.items, performed_by_user_id: actor.userId, performed_by_email: actor.email }),
      });
      const changed: unknown = await response.json();
      if (!response.ok || typeof changed !== "boolean") throw new Error("Baguio order revision failed.");
      return changed;
    },
    async createBaguioDispatch(input, actor) {
      assertConfigured();
      const driver = await loadDispatchDriver(url, secretKey, input.driverUserId);
      const response = await fetch(`${url}/rest/v1/rpc/create_baguio_dispatch`, {
        method: "POST", headers: requestHeaders,
        body: JSON.stringify({
          target_van_id: input.vanLocationId,
          assigned_driver_user_id: driver.userId,
          assigned_driver_name: driver.name,
          assigned_driver_email: driver.email,
          dispatch_notes: input.notes,
          performed_by_user_id: actor.userId,
          performed_by_email: actor.email,
        }),
      });
      const id: unknown = await response.json();
      if (!response.ok || typeof id !== "string") throw new Error("Baguio dispatch storage request failed.");
      return id;
    },
    async advanceBaguioDispatch(id, action, actor) {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/rpc/advance_baguio_dispatch`, {
        method: "POST", headers: requestHeaders,
        body: JSON.stringify({ target_dispatch_id: id, requested_action: action, performed_by_user_id: actor.userId, performed_by_email: actor.email }),
      });
      const changed: unknown = await response.json();
      if (!response.ok || typeof changed !== "boolean") throw new Error("Baguio dispatch storage request failed.");
      return changed;
    },
    async advanceBaguioSale(id, action, actor) {
      assertConfigured();
      const response = await fetch(`${url}/rest/v1/rpc/advance_baguio_sale`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ target_order_id: id, requested_action: action, performed_by_user_id: actor.userId, performed_by_email: actor.email }),
      });
      if (!response.ok) throw new Error("Channel sales storage request failed.");
      const changed: unknown = await response.json();
      if (typeof changed !== "boolean") throw new Error("Channel sales storage returned invalid data.");
      return changed;
    },
    async completeDriverDelivery(id, proof, actor) {
      assertConfigured();
      return completeDriverDelivery(url, secretKey, id, proof, actor);
    },
    async startDriverTrip(id, actor) {
      assertConfigured();
      return startAssignedDriverTrip(url, secretKey, id, actor);
    },
    async reconcileDriverDispatch(id, input, actor) {
      assertConfigured();
      return reconcileAssignedDriverDispatch(url, secretKey, id, input, actor);
    },
  };
}

function readSale(value: unknown): BaguioSale {
  if (!isRecord(value) || !isRecord(value.inventory_locations)) throw new Error("Channel sales storage returned invalid data.");
  const items = readArray(value.channel_sale_items);
  const deliveryOrder = readFirst(value.delivery_order_forms);
  const deliveryReceipt = readFirst(value.delivery_receipts);
  return {
    id: readString(value.id), referenceNumber: readString(value.reference_number), status: readSaleStatus(value.status),
    clientName: readString(value.client_name), clientAddress: readString(value.client_address), clientPhone: readString(value.client_phone), customerId: readString(value.customer_id), dispatchId: readString(value.dispatch_id), addedAfterDeparture: readBoolean(value.added_after_departure), revisionCount: readArray(value.channel_sale_revisions).length,
    customerAddressId: readNullableString(value.customer_address_id),
    deliveryNotes: readString(value.delivery_notes), van: readInventoryLocation(value.inventory_locations), total: readNumber(value.total), createdAt: readString(value.created_at),
    deliveryOrder: { number: readString(deliveryOrder.document_number), status: readDeliveryOrderStatus(deliveryOrder.status), preparedByName: readString(deliveryOrder.prepared_by_name) },
    deliveryReceipt: {
      number: readString(deliveryReceipt.document_number),
      status: readDeliveryReceiptStatus(deliveryReceipt.status),
      clientAcknowledgedAt: readNullableString(deliveryReceipt.client_acknowledged_at),
      proof: readSavedDriverDeliveryProof(deliveryReceipt),
    },
    items: items.map((item) => ({ productVariantId: readString(item.product_variant_id), productTitle: readString(item.product_title), variantLabel: readString(item.variant_label), quantity: readNumber(item.quantity), unitPrice: readNumber(item.unit_price), lineTotal: readNumber(item.line_total) })),
  };
}

function readArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error("Channel sales storage returned invalid data.");
  return value;
}

function readFirst(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  const rows = readArray(value);
  if (!rows[0]) throw new Error("Channel sales storage returned incomplete document data.");
  return rows[0];
}

function readRecordId(value: unknown): string {
  if (!isRecord(value)) throw new Error("Baguio dispatch storage returned invalid data.");
  return readString(value.id);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function readString(value: unknown): string { if (typeof value !== "string") throw new Error("Channel sales storage returned invalid data."); return value; }
function readNullableString(value: unknown): string | null { return value == null ? null : readString(value); }
function readNumber(value: unknown): number { const parsed = typeof value === "number" ? value : Number(value); if (!Number.isFinite(parsed)) throw new Error("Channel sales storage returned invalid data."); return parsed; }
function readBoolean(value: unknown): boolean { if (typeof value !== "boolean") throw new Error("Channel sales storage returned invalid data."); return value; }

function readSaleStatus(value: unknown): ChannelSaleStatus {
  const status = readString(value);
  if (!["draft", "pending_approval", "approved", "loaded", "in_transit", "delivered", "successful", "cancelled"].includes(status)) throw new Error("Channel sales storage returned invalid data.");
  return status as ChannelSaleStatus;
}

function readDeliveryOrderStatus(value: unknown): DeliveryOrderStatus {
  const status = readString(value);
  if (!["draft", "ready_for_signature", "approved", "dispatched", "cancelled"].includes(status)) throw new Error("Channel sales storage returned invalid data.");
  return status as DeliveryOrderStatus;
}

function readDeliveryReceiptStatus(value: unknown): DeliveryReceiptStatus {
  const status = readString(value);
  if (!["pending", "issued", "cancelled"].includes(status)) throw new Error("Channel sales storage returned invalid data.");
  return status as DeliveryReceiptStatus;
}
