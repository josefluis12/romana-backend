import assert from "node:assert/strict";
import test from "node:test";
import { createAttemptLimiter, parseCookies, safeEqual } from "../src/security.js";

test("limits repeated failed sign-in attempts and allows clearing", () => {
  const limiter = createAttemptLimiter({ limit: 2 });
  limiter.recordFailure("client");
  limiter.recordFailure("client");
  assert.equal(limiter.isLimited("client"), true);
  limiter.clear("client");
  assert.equal(limiter.isLimited("client"), false);
});

test("resets the attempt window", () => {
  let now = 100;
  const limiter = createAttemptLimiter({ limit: 1, windowMs: 50, now: () => now });
  limiter.recordFailure("client");
  assert.equal(limiter.isLimited("client"), true);
  now = 151;
  assert.equal(limiter.isLimited("client"), false);
});

test("parses valid cookies and ignores malformed encoding", () => {
  assert.deepEqual(parseCookies("one=first; session=a%20b; broken=%E0%A4%A"), { one: "first", session: "a b" });
});

test("compares CSRF values safely", () => {
  assert.equal(safeEqual("token", "token"), true);
  assert.equal(safeEqual("token", "different"), false);
  assert.equal(safeEqual(undefined, undefined), false);
});
