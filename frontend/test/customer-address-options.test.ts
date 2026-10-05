import assert from "node:assert/strict";
import test from "node:test";
import { getCustomerAddressOptions, getDefaultCustomerAddressId } from "../src/app/(dashboard)/baguio-sales/_lib/customer-address-options.ts";
import type { CustomerAddress } from "../src/types/channel-sale.ts";

const addresses: CustomerAddress[] = [
  makeAddress("store", "Main Store", "123 Session Road", true),
  makeAddress("warehouse", "Warehouse", "45 Marcos Highway", false),
  makeAddress("home", "Owner's Home", "78 Outlook Drive", false),
];

test("creates a selectable option for every saved customer address", () => {
  assert.deepEqual(
    getCustomerAddressOptions(addresses).map(({ id, label, formattedAddress }) => ({ id, label, formattedAddress })),
    [
      { id: "store", label: "Main Store", formattedAddress: "123 Session Road" },
      { id: "warehouse", label: "Warehouse", formattedAddress: "45 Marcos Highway" },
      { id: "home", label: "Owner's Home", formattedAddress: "78 Outlook Drive" },
    ],
  );
});

test("selects the default saved address initially", () => {
  const customer = { addresses };
  assert.equal(getDefaultCustomerAddressId(customer), "store");
  assert.equal(getDefaultCustomerAddressId({ addresses: addresses.map((address) => ({ ...address, isDefault: false })) }), "store");
  assert.equal(getDefaultCustomerAddressId(undefined), "");
});

function makeAddress(id: string, label: string, formattedAddress: string, isDefault: boolean): CustomerAddress {
  return {
    id,
    label,
    formattedAddress,
    isDefault,
    address: {
      street: formattedAddress,
      region: "CAR",
      province: "Benguet",
      locality: "Baguio City",
      district: "",
      barangay: "",
      postalCode: "2600",
      country: "Philippines",
    },
  };
}
