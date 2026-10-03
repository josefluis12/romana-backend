import assert from "node:assert/strict";
import test from "node:test";
import { filterDispatchesByView } from "../src/features/dispatches/dispatch-view.ts";
import type { DriverDispatch, DriverDispatchStatus } from "../src/types/dispatch.ts";

function dispatch(id: string, status: DriverDispatchStatus): DriverDispatch {
  return {
    id,
    status,
    referenceNumber: `DSP-${id}`,
    vanName: "Van 1",
    createdAt: "2026-10-03T00:00:00.000Z",
    departedAt: null,
    orders: [],
  };
}

const dispatches = [
  dispatch("completed", "completed"),
  dispatch("transit", "in_transit"),
  dispatch("cancelled", "cancelled"),
  dispatch("preparing", "preparing"),
  dispatch("ready", "ready_for_departure"),
];

test("shows only released and in-transit dispatches on the current trip screen", () => {
  assert.deepEqual(filterDispatchesByView(dispatches, "active").map(({ id }) => id), [
    "transit",
    "ready",
  ]);
});

test("shows only completed and cancelled dispatches in trip history", () => {
  assert.deepEqual(filterDispatchesByView(dispatches, "history").map(({ id }) => id), [
    "completed",
    "cancelled",
  ]);
});
