import type { BaguioClient, CustomerAddress } from "../../../../types/channel-sale";

export function getCustomerAddressOptions(addresses: CustomerAddress[]): CustomerAddress[] {
  return addresses.map((address) => ({ ...address }));
}

export function getDefaultCustomerAddressId(customer: Pick<BaguioClient, "addresses"> | undefined): string {
  return customer?.addresses.find((address) => address.isDefault)?.id
    ?? customer?.addresses[0]?.id
    ?? "";
}
