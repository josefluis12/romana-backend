import assert from "node:assert/strict";
import test from "node:test";
import { mergeCustomerDirectory, summarizeCustomerChannels } from "../src/components/customer-analytics.ts";
import type { BaguioClient } from "../src/types/channel-sale.ts";

const registeredCustomer: BaguioClient = {
  id: "11111111-1111-4111-8111-111111111111",
  referenceNumber: "CUS-000001",
  name: "Baguio Market",
  address: "Session Road, Baguio City",
  structuredAddress: null,
  phone: "09171234567",
  email: "",
  contactPerson: "Ana Cruz",
  isActive: true,
  createdAt: "2026-09-28T00:00:00.000Z",
};

test("includes registered customers without online orders in the overview", () => {
  const customers = mergeCustomerDirectory([registeredCustomer], []);
  assert.deepEqual(customers, [{
    id: registeredCustomer.id,
    email: "",
    name: registeredCustomer.name,
    phone: registeredCustomer.phone,
    orderCount: 0,
    totalSpent: 0,
    latestOrderAt: registeredCustomer.createdAt,
    location: registeredCustomer.address,
  }]);
});

test("summarizes customers across online and Baguio channels", () => {
  const onlineOnly = { ...registeredCustomer, id: "online", name: "Online Customer" };
  const both = { ...registeredCustomer, id: "both", name: "Multi-channel Customer" };
  const baguioOnly = { ...registeredCustomer, id: "baguio", name: "Baguio Customer" };
  assert.deepEqual(
    summarizeCustomerChannels([onlineOnly, both, baguioOnly], [onlineOnly, both], [both, baguioOnly]),
    { total: 3, online: 2, baguio: 2, multipleChannels: 1 },
  );
});
