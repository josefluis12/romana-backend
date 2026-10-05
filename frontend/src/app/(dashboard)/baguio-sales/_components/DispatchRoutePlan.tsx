import { ExternalLink, MapPinned, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { BaguioDispatch, BaguioSale } from "../../../../types/channel-sale";
import { getBaguioSaleStatusLabel } from "../_lib/workflow";

const DEPOT_ADDRESS = "744 De Vera St, Mangaldan, Pangasinan";

export function DispatchRoutePlan({ dispatch }: { dispatch: BaguioDispatch }) {
  const [mapFailed, setMapFailed] = useState(false);
  const revision = dispatch.orders.map((order) => `${order.id}:${order.status}:${order.revisionCount}`).join(",");
  const mapUrl = `/api/channel-sales/baguio/dispatches/${encodeURIComponent(dispatch.id)}/map?revision=${encodeURIComponent(revision)}`;

  return (
    <section className="mt-5 min-w-0" aria-label="Google optimized dispatch route">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 flex items-center gap-2 text-base"><MapPinned className="size-5 text-[var(--red)]" />Google route plan</h3>
          <p className="mb-0 mt-1 text-xs text-[var(--muted)]">Optimized for pending stops from {DEPOT_ADDRESS}.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold" aria-label="Map pin status legend">
          <Legend color="bg-[#d58a00]" label="Pending" />
          <Legend color="bg-[#2e7d32]" label="Delivered" />
          <Legend color="bg-[#c62828]" label="Cancelled" />
        </div>
      </header>

      <div className="mt-4 overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
        {dispatch.orders.length === 0 ? (
          <p className="m-0 p-8 text-center text-sm text-[var(--muted)]">Add an order to this dispatch to build its route.</p>
        ) : mapFailed ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div><MapPinned className="mx-auto size-8 text-[var(--muted)]" /><p className="mb-0 mt-3 text-sm font-bold">The Google route map is unavailable.</p></div>
          </div>
        ) : (
          <img className="block aspect-video w-full object-cover" src={mapUrl} alt={`Google optimized route for ${dispatch.referenceNumber}`} onError={() => setMapFailed(true)} />
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]"><RefreshCw className="size-3.5" />Statuses and pins refresh automatically while this page is open.</p>
      <ol className="mt-4 grid gap-2 p-0 sm:grid-cols-2">
        {dispatch.orders.map((order) => <RouteStop order={order} key={order.id} />)}
      </ol>
    </section>
  );
}

function RouteStop({ order }: { order: BaguioSale }) {
  const mapUrl = new URL("https://www.google.com/maps/search/");
  mapUrl.searchParams.set("api", "1");
  mapUrl.searchParams.set("query", order.clientAddress);
  return (
    <li className="flex min-w-0 gap-3 rounded border border-[var(--line)] bg-white p-3">
      <span className={`mt-1 size-3 shrink-0 rounded-full ${statusColor(order.status)}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <strong className="text-xs">{order.referenceNumber} · {order.clientName}</strong>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusBadge(order.status)}`}>{getBaguioSaleStatusLabel(order.status)}</span>
        </div>
        <p className="mb-0 mt-1 text-xs text-[var(--muted)]">{order.clientAddress}</p>
        <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--red)] hover:underline" href={mapUrl.toString()} target="_blank" rel="noreferrer">Open order in Google Maps<ExternalLink className="size-3" /></a>
      </div>
    </li>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${color}`} aria-hidden="true" />{label}</span>;
}

function statusColor(status: BaguioSale["status"]): string {
  if (status === "delivered" || status === "successful") return "bg-[#2e7d32]";
  if (status === "cancelled") return "bg-[#c62828]";
  return "bg-[#d58a00]";
}

function statusBadge(status: BaguioSale["status"]): string {
  if (status === "delivered" || status === "successful") return "bg-[#dff2e5] text-[#1f6634]";
  if (status === "cancelled") return "bg-[#fae3e3] text-[#8b1d22]";
  return "bg-[#fff0c7] text-[#785000]";
}
