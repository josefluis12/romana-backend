import { useState } from "react";
import { ChevronDown, ChevronRight, PackageOpen, Search, Truck, X } from "lucide-react";
import type { BaguioDispatch } from "../../../../types/channel-sale";
import { matchesBaguioDispatchSearch } from "../_lib/dispatch-search";
import { matchesBaguioOrderSearch } from "../_lib/order-search";
import { getBaguioSaleStatusLabel } from "../_lib/workflow";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
type DispatchFilter = "all" | "active" | "completed";

export function BaguioOrdersByDispatch({ dispatches }: { dispatches: BaguioDispatch[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DispatchFilter>("active");
  if (!dispatches.length) {
    return (
      <div className="empty-state">
        <Truck />
        <h2>No Baguio dispatches yet</h2>
        <p>Create a dispatch before adding its customer orders.</p>
      </div>
    );
  }

  const searchTerm = query.trim();
  const filteredDispatches = dispatches.filter((dispatch) => {
    if (filter === "active") return ["preparing", "ready_for_departure", "in_transit"].includes(dispatch.status);
    if (filter === "completed") return dispatch.status === "completed";
    return true;
  });
  const visibleDispatches = searchTerm
    ? filteredDispatches
      .map((dispatch) => {
        const dispatchMatches = matchesBaguioDispatchSearch({ ...dispatch, orders: [] }, searchTerm);
        const orders = dispatchMatches
          ? dispatch.orders
          : dispatch.orders.filter((order) => matchesBaguioOrderSearch(order, searchTerm, getBaguioSaleStatusLabel(order.status)));
        return { dispatch: { ...dispatch, orders }, matches: dispatchMatches || orders.length > 0 };
      })
      .filter((result) => result.matches)
      .map((result) => result.dispatch)
    : filteredDispatches;
  const resultCount = visibleDispatches.reduce((sum, dispatch) => sum + dispatch.orders.length, 0);

  return (
    <div className="mt-6">
      <div className="mb-5 flex gap-2 border-b border-[var(--line)]" role="tablist" aria-label="Filter dispatches by status">
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>All</FilterTab>
        <FilterTab active={filter === "active"} onClick={() => setFilter("active")}>Active</FilterTab>
        <FilterTab active={filter === "completed"} onClick={() => setFilter("completed")}>Completed</FilterTab>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-md">
          <label className="mb-2 block text-sm font-bold" htmlFor="baguio-order-search">Search dispatches and orders</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input
              className="h-11 w-full border border-[var(--line)] bg-white py-2 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--red)]"
              id="baguio-order-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Dispatch, order, customer, product, or status"
            />
            {query && <button className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center border-0 bg-transparent text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--red)]" type="button" aria-label="Clear order search" title="Clear order search" onClick={() => setQuery("")}><X className="size-4" /></button>}
          </div>
        </div>
        {searchTerm && <p className="m-0 text-sm text-[var(--muted)]" role="status">{visibleDispatches.length} dispatch{visibleDispatches.length === 1 ? "" : "es"} · {resultCount} order{resultCount === 1 ? "" : "s"}</p>}
      </div>
      {!visibleDispatches.length ? (
        !searchTerm ? <FilteredEmptyState filter={filter} /> :
        <div className="empty-state mt-6"><PackageOpen /><h2>No matching results</h2><p>Try a different dispatch, order, customer, product, or status.</p></div>
      ) : (
        <div className="mt-4 grid gap-3">
          {visibleDispatches.map((dispatch) => (
            <DispatchOrderGroup dispatch={dispatch} key={dispatch.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`border-0 border-b-2 bg-transparent px-4 py-3 text-sm font-bold ${active ? "border-[var(--red)] text-[var(--red)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`} type="button" role="tab" aria-selected={active} onClick={onClick}>{children}</button>;
}

function FilteredEmptyState({ filter }: { filter: DispatchFilter }) {
  const description = filter === "active"
    ? "There are no dispatches currently being prepared, awaiting departure, or in transit."
    : filter === "completed"
      ? "No dispatches have been completed yet."
      : "Create a dispatch before adding its customer orders.";
  return <div className="empty-state mt-6"><PackageOpen /><h2>No {filter === "all" ? "" : `${filter} `}dispatches</h2><p>{description}</p></div>;
}

function DispatchOrderGroup({ dispatch }: { dispatch: BaguioDispatch }) {
  const total = dispatch.orders.reduce((sum, order) => sum + order.total, 0);
  return (
    <section className="min-w-0 overflow-hidden border border-[var(--line)] bg-white">
      <details className="group overflow-x-auto">
        <summary className="grid min-w-[820px] cursor-pointer list-none grid-cols-[20px_105px_100px_minmax(120px,1fr)_minmax(120px,1fr)_180px_70px_110px] items-center gap-3 bg-[var(--paper)] px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--red)] [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
          <strong className="truncate uppercase text-[var(--red)]" title={dispatch.referenceNumber}>{dispatch.referenceNumber}</strong>
          <Status value={dispatch.status} />
          <span className="flex min-w-0 items-center gap-2 font-bold" title={dispatch.van.name}><Truck className="size-4 shrink-0" /><span className="truncate">{dispatch.van.name}</span></span>
          <span className="truncate text-[var(--muted)]" title={dispatch.driver?.name || "Unassigned"}>Driver: {dispatch.driver?.name || "Unassigned"}</span>
          <span className="whitespace-nowrap text-[var(--muted)]">Created {date.format(new Date(dispatch.createdAt))}</span>
          <span className="whitespace-nowrap text-right font-bold">{dispatch.orders.length} order{dispatch.orders.length === 1 ? "" : "s"}</span>
          <strong className="whitespace-nowrap text-right">{peso.format(total)}</strong>
        </summary>
        <div className="border-t border-[var(--line)]">
          <div className="flex justify-end border-b border-[var(--line)] px-3 py-2">
            <a className="flex items-center gap-1 text-xs font-bold text-[var(--red)] no-underline hover:underline" href={`#baguio-sales/dispatches/${dispatch.id}`}>View dispatch<ChevronRight className="size-4" /></a>
          </div>
          {!dispatch.orders.length ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]"><PackageOpen className="size-4" />No orders assigned yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead className="bg-[var(--paper)] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-bold">Order</th>
                    <th className="px-3 py-2 font-bold">Customer</th>
                    <th className="px-3 py-2 text-right font-bold">Products</th>
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {dispatch.orders.map((order) => (
                    <tr className="border-t border-[var(--line)]" key={order.id}>
                      <td className="whitespace-nowrap px-3 py-2 font-bold">{order.referenceNumber}</td>
                      <td className="max-w-56 truncate whitespace-nowrap px-3 py-2" title={order.clientName}>{order.clientName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{order.items.length} line{order.items.length === 1 ? "" : "s"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold">{peso.format(order.total)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase leading-none ${statusTone(order.status)}`}>
                          {getBaguioSaleStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right"><a className="inline-flex items-center gap-1 font-bold text-[var(--red)] no-underline hover:underline" href={`#baguio-sales/${order.id}`}>View<ChevronRight className="size-3" /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function Status({ value }: { value: BaguioDispatch["status"] }) {
  return <span className={`inline-flex w-max rounded-full px-2 py-1 text-[10px] font-bold uppercase leading-none ${statusTone(value)}`}>{value.replaceAll("_", " ")}</span>;
}

function statusTone(status: string): string {
  if (["completed", "delivered", "successful"].includes(status)) return "bg-emerald-100 text-emerald-700";
  if (status === "in_transit") return "bg-blue-100 text-blue-700";
  if (status === "ready_for_departure") return "bg-violet-100 text-violet-700";
  if (["approved", "loaded"].includes(status)) return "bg-sky-100 text-sky-700";
  if (["preparing", "pending_approval"].includes(status)) return "bg-amber-100 text-amber-800";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}
