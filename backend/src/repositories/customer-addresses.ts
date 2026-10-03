import type { ChannelSaleActor } from "./channel-sales.js";
import type { CustomerAddress, CustomerAddressInput } from "../types/channel-sales.js";
import { readCustomerAddress } from "./channel-sales-readers.js";

export const customerSelect = "id,reference_number,business_name,first_name,last_name,default_address,default_shipping_address,phone,email,contact_person,is_active,created_at,customer_addresses(id,label,address,formatted_address,is_default)";

export async function saveCustomerAddress(
  url: string,
  headers: Record<string, string>,
  customerId: string,
  input: CustomerAddressInput,
  actor: ChannelSaleActor,
): Promise<CustomerAddress> {
  const response = await fetch(`${url}/rest/v1/rpc/add_customer_address`, {
    method: "POST",
    headers,
    body: JSON.stringify({ target_customer_id: customerId, address_label: input.label, address_data: input.address, performed_by_user_id: actor.userId }),
  });
  const id: unknown = await response.json();
  if (!response.ok || typeof id !== "string") throw new Error("Customer address could not be saved.");
  const saved = await fetch(`${url}/rest/v1/customer_addresses?select=id,label,address,formatted_address,is_default&id=eq.${encodeURIComponent(id)}`, { headers });
  const value: unknown = await saved.json();
  if (!saved.ok || !Array.isArray(value) || !value[0]) throw new Error("Customer address storage returned invalid data.");
  return readCustomerAddress(value[0]);
}
