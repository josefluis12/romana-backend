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
    if (filter === "active") return dispatch.status === "preparing" || dispatch.status === "in_transit";
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
        <div className="mt-6 grid gap-6">
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
    ? "There are no dispatches currently being prepared or in transit."
    : filter === "completed"
      ? "No dispatches have been completed yet."
      : "Create a dispatch before adding its customer orders.";
  return <div className="empty-state mt-6"><PackageOpen /><h2>No {filter === "all" ? "" : `${filter} `}dispatches</h2><p>{description}</p></div>;
}

function DispatchOrderGroup({ dispatch }: { dispatch: BaguioDispatch }) {
  const total = dispatch.orders.reduce((sum, order) => sum + order.total, 0);
  return (
    <section className="min-w-0 border border-[var(--line)] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--paper)] p-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase text-[var(--red)]">{dispatch.referenceNumber}</span>
              <Status value={dispatch.status} />
            </span>
            <span className="mt-2 flex items-center gap-2 text-lg font-bold"><Truck className="size-4 shrink-0" />{dispatch.van.name}</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">Driver: {dispatch.driver?.name || "Unassigned"}</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">Created {date.format(new Date(dispatch.createdAt))}</span>
          </span>
          <span className="text-right text-sm font-bold">{dispatch.orders.length} order{dispatch.orders.length === 1 ? "" : "s"} · {peso.format(total)}</span>
        </div>
        <a className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--red)] no-underline hover:underline" href={`#baguio-sales/dispatches/${dispatch.id}`}>View dispatch<ChevronRight className="size-4" /></a>
      </header>
      <details className="group border-t border-[var(--line)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--red)] [&::-webkit-details-marker]:hidden">
          <span>{dispatch.orders.length ? `Show ${dispatch.orders.length} order${dispatch.orders.length === 1 ? "" : "s"}` : "No orders assigned yet"}</span>
          <ChevronDown className="size-5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-[var(--line)]">
          {!dispatch.orders.length ? (
            <div className="flex items-center gap-3 p-5 text-sm text-[var(--muted)]"><PackageOpen className="size-5" />No orders assigned yet.</div>
          ) : (
            <div className="grid gap-3 p-4 sm:p-5">
              {dispatch.orders.map((order) => (
                <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border border-[var(--line)] p-4 sm:grid-cols-[minmax(160px,1fr)_minmax(140px,.8fr)_120px_auto]" key={order.id}>
                  <span><strong className="block">{order.referenceNumber}</strong><small className="text-[var(--muted)]">{order.clientName}</small></span>
                  <span className="col-start-1 row-start-2 text-sm sm:col-auto sm:row-auto">{order.items.length} product line{order.items.length === 1 ? "" : "s"}</span>
                  <span className="col-start-1 row-start-3 sm:col-auto sm:row-auto"><strong className="block text-sm">{peso.format(order.total)}</strong><small className="text-[var(--red)]">{getBaguioSaleStatusLabel(order.status)}</small></span>
                  <a className="col-start-2 row-span-3 row-start-1 flex items-center gap-1 text-sm font-bold text-[var(--red)] no-underline hover:underline sm:col-auto sm:row-auto" href={`#baguio-sales/${order.id}`}>View order<ChevronRight className="size-4" /></a>
                </article>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function Status({ value }: { value: BaguioDispatch["status"] }) {
  return <span className="inline-flex rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)]">{value.replaceAll("_", " ")}</span>;
}
