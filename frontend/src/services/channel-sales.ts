import { fetchWithCsrf } from "./products";
import type { BaguioClient, BaguioClientInput, BaguioDispatch, BaguioDispatchAction, BaguioDispatchInput, BaguioSale, BaguioSaleAction, BaguioSaleInput, BaguioSaleUpdateInput, CustomerAddress, CustomerAddressInput, DispatchDriver, InventoryLocation, PhilippineAddress } from "../types/channel-sale";

interface ErrorResponse { error?: string }
export interface CustomerPlacePrediction { placeId: string; address: string }
export interface ResolvedCustomerPlace { placeId: string; formattedAddress: string; address: PhilippineAddress }

export async function searchCustomerLocations(input: string, sessionToken: string, signal?: AbortSignal): Promise<CustomerPlacePrediction[]> {
  const query = new URLSearchParams({ input, sessionToken });
  const response = await fetch(`/api/customer-locations/autocomplete?${query}`, { credentials: "include", signal });
  const result = await readJson<{ predictions?: CustomerPlacePrediction[]; error?: string }>(response);
  if (!response.ok || !result.predictions) throw new Error(result.error || "Address suggestions are unavailable.");
  return result.predictions;
}

export async function getCustomerLocation(placeId: string, sessionToken: string): Promise<ResolvedCustomerPlace> {
  const query = new URLSearchParams({ sessionToken });
  const response = await fetch(`/api/customer-locations/places/${encodeURIComponent(placeId)}?${query}`, { credentials: "include" });
  const result = await readJson<{ place?: ResolvedCustomerPlace; error?: string }>(response);
  if (!response.ok || !result.place) throw new Error(result.error || "The selected address could not be loaded.");
  return result.place;
}
export async function listBaguioSales(): Promise<BaguioSale[]> {
  const response = await fetch("/api/channel-sales/baguio", { credentials: "include" });
  const result = await readJson<{ sales: BaguioSale[]; error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load Baguio sales.");
  return result.sales;
}

export async function listBaguioDispatches(): Promise<BaguioDispatch[]> {
  const response = await fetch("/api/channel-sales/baguio/dispatches", { credentials: "include" });
  const result = await readJson<{ dispatches: BaguioDispatch[]; error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load Baguio dispatches.");
  return result.dispatches;
}

export async function listVehicles(): Promise<InventoryLocation[]> {
  const response = await fetch("/api/inventory/vehicles", { credentials: "include" });
  const result = await readJson<{ vehicles: InventoryLocation[]; error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load vans.");
  return result.vehicles;
}

export async function listDispatchDrivers(): Promise<DispatchDriver[]> {
  const response = await fetch("/api/dispatch-drivers", { credentials: "include" });
  const result = await readJson<{ drivers: DispatchDriver[]; error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "Unable to load driver accounts.");
  return result.drivers;
}

export async function listBaguioClients(): Promise<BaguioClient[]> {
  return listChannelCustomers("baguio");
}

export async function listOnlineCustomers(): Promise<BaguioClient[]> {
  return listChannelCustomers("online");
}

async function listChannelCustomers(channel: "baguio" | "online"): Promise<BaguioClient[]> {
  const clients: BaguioClient[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const response: Response = await fetch(`/api/customers/directory/${channel}?offset=${offset}`, { credentials: "include" });
    const result: { customers: BaguioClient[]; nextOffset: number | null; error?: string } = await readJson(response);
    if (!response.ok) throw new Error(result.error || `Unable to load ${channel} customers.`);
    clients.push(...result.customers);
    offset = result.nextOffset;
  }
  return clients;
}

export async function listCustomers(): Promise<BaguioClient[]> {
  const customers: BaguioClient[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const response: Response = await fetch(`/api/customers/directory?offset=${offset}`, { credentials: "include" });
    const result: { customers: BaguioClient[]; nextOffset: number | null; error?: string } = await readJson(response);
    if (!response.ok) throw new Error(result.error || "Unable to load the customer directory.");
    customers.push(...result.customers);
    offset = result.nextOffset;
  }
  return customers;
}

export async function createBaguioClient(input: BaguioClientInput, csrfToken: string): Promise<BaguioClient> {
  const response = await fetchWithCsrf("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<{ client?: BaguioClient; error?: string }>(response);
  if (!response.ok || !result.client) throw new Error(result.error || "Unable to register the Baguio client.");
  return result.client;
}

export async function createCustomerAddress(customerId: string, input: CustomerAddressInput, csrfToken: string): Promise<CustomerAddress> {
  const response = await fetchWithCsrf(`/api/customers/${customerId}/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<{ address?: CustomerAddress; error?: string }>(response);
  if (!response.ok || !result.address) throw new Error(result.error || "Unable to save the customer address.");
  return result.address;
}

export async function createBaguioSale(input: BaguioSaleInput, csrfToken: string): Promise<string> {
  const response = await fetchWithCsrf("/api/channel-sales/baguio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<{ id?: string; error?: string }>(response);
  if (!response.ok || !result.id) throw new Error(result.error || "Unable to create the Baguio order.");
  return result.id;
}

export async function updateBaguioSale(id: string, input: BaguioSaleUpdateInput, csrfToken: string): Promise<void> {
  const response = await fetchWithCsrf(`/api/channel-sales/baguio/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<ErrorResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to update the Baguio order.");
}

export async function createBaguioDispatch(input: BaguioDispatchInput, csrfToken: string): Promise<string> {
  const response = await fetchWithCsrf("/api/channel-sales/baguio/dispatches", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }, csrfToken);
  const result = await readJson<{ id?: string; error?: string }>(response);
  if (!response.ok || !result.id) throw new Error(result.error || "Unable to create the dispatch.");
  return result.id;
}

export async function advanceBaguioDispatch(id: string, action: BaguioDispatchAction, csrfToken: string): Promise<void> {
  const response = await fetchWithCsrf(`/api/channel-sales/baguio/dispatches/${id}/${action}`, { method: "POST" }, csrfToken);
  const result = await readJson<ErrorResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to update the dispatch.");
}

export async function advanceBaguioSale(id: string, action: BaguioSaleAction, csrfToken: string): Promise<void> {
  const response = await fetchWithCsrf(`/api/channel-sales/baguio/${id}/${action}`, { method: "POST" }, csrfToken);
  const result = await readJson<ErrorResponse>(response);
  if (!response.ok) throw new Error(result.error || "Unable to update the Baguio order.");
}

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}
