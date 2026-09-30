import assert from "node:assert/strict";
import test from "node:test";
import { validateDispatchDriverInput } from "../src/schemas/channel-sales.js";

test("validates and preserves separate driver name fields", () => {
  const result = validateDispatchDriverInput({
    firstName: "  Juan ",
    middleName: " Santos ",
    lastName: " Cruz ",
    email: "DRIVER@EXAMPLE.COM",
    temporaryPassword: "temporary-pass-123",
  });

  assert.deepEqual(result, {
    driver: {
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Cruz",
      email: "driver@example.com",
      temporaryPassword: "temporary-pass-123",
    },
  });
});

test("rejects a driver account without a last name", () => {
  const result = validateDispatchDriverInput({
    firstName: "Juan",
    middleName: "",
    email: "driver@example.com",
    temporaryPassword: "temporary-pass-123",
  });

  assert.deepEqual(result, { error: "Enter the driver's last name." });
});
