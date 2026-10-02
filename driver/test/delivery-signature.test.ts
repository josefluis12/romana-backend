import assert from "node:assert/strict";
import test from "node:test";
import { getCompleteSignatureStrokes } from "../src/features/dispatches/delivery-signature.ts";

test("keeps a valid signature while discarding accidental taps", () => {
  const validStroke = [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 }];
  const signature = getCompleteSignatureStrokes([
    validStroke,
    [{ x: 0.8, y: 0.4 }],
  ]);

  assert.deepEqual(signature, [validStroke]);
});

test("does not treat a tap as a signature", () => {
  assert.deepEqual(getCompleteSignatureStrokes([[{ x: 0.1, y: 0.2 }]]), []);
});
