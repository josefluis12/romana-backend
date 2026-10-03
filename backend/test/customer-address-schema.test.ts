import assert from "node:assert/strict";
import test from "node:test";
import { validateBaguioSaleInput, validateCustomerAddressInput } from "../src/schemas/channel-sales.js";
import { structuredAddress } from "./channel-sales.fixtures.js";

const base = {
  customerId: "66666666-6666-4666-8666-666666666666",
  dispatchId: "77777777-7777-4777-8777-777777777777",
  deliveryNotes: "",
  items: [{ productVariantId: "99999999-9999-4999-8999-999999999999", quantity: 1, unitPrice: 320 }],
};

test("requires a saved customer address for a Baguio order", () => {
  assert.deepEqual(validateBaguioSaleInput(base), { error: "Choose a saved customer address." });
});

test("accepts a saved customer address identifier", () => {
  const customerAddressId = "88888888-8888-4888-8888-888888888888";
  assert.equal(validateBaguioSaleInput({ ...base, customerAddressId }).sale?.customerAddressId, customerAddressId);
});

test("validates a labeled Philippine customer address", () => {
  assert.deepEqual(validateCustomerAddressInput({ label: "Warehouse", address: structuredAddress }).address, {
    label: "Warehouse",
    address: structuredAddress,
  });
  assert.equal(validateCustomerAddressInput({ label: "", address: structuredAddress }).error, "Enter an address label.");
});
