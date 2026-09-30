import assert from "node:assert/strict";
import test from "node:test";
import { validateSystemUserInput } from "../src/schemas/system-user.js";

test("validates system users with a selected role and confirmed password", () => {
  const result = validateSystemUserInput({
    firstName: "  Juan ",
    middleName: " Santos ",
    lastName: " Cruz ",
    email: "DRIVER@EXAMPLE.COM",
    role: "dispatch_driver",
    password: "temporary-pass-123",
    passwordConfirmation: "temporary-pass-123",
  });

  assert.deepEqual(result, {
    user: {
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Cruz",
      email: "driver@example.com",
      role: "dispatch_driver",
      password: "temporary-pass-123",
    },
  });
});

test("rejects a user when password confirmation does not match", () => {
  const result = validateSystemUserInput({
    firstName: "Juan",
    middleName: "",
    lastName: "Cruz",
    email: "driver@example.com",
    role: "dispatch_driver",
    password: "temporary-pass-123",
    passwordConfirmation: "different-pass-123",
  });

  assert.deepEqual(result, { error: "The password confirmation does not match." });
});
