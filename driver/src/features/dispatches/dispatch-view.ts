import type { DriverDispatch } from "../../types/dispatch";

export type DispatchView = "active" | "history";

export function filterDispatchesByView(
  dispatches: DriverDispatch[],
  view: DispatchView,
): DriverDispatch[] {
  return dispatches.filter((dispatch) => view === "active"
    ? dispatch.status === "ready_for_departure" || dispatch.status === "in_transit"
    : dispatch.status === "completed" || dispatch.status === "cancelled");
}
