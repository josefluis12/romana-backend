import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectedAmount } from "../src/features/dispatches/delivery-payment.ts";

test("reads a positive collected amount with up to two decimal places", () => {
  assert.equal(parseCollectedAmount("1250"), 1250);
  assert.equal(parseCollectedAmount("1250.50"), 1250.5);
});

test("rejects missing, zero, negative, and over-precise collected amounts", () => {
  assert.equal(parseCollectedAmount(""), null);
  assert.equal(parseCollectedAmount("0"), null);
  assert.equal(parseCollectedAmount("-20"), null);
  assert.equal(parseCollectedAmount("20.001"), null);
});
