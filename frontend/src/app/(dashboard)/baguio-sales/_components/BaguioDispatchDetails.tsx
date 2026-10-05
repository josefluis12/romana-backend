import { useMemo, useState } from "react";
import { ArrowLeft, Check, MapPin, Printer } from "lucide-react";
import type { BaguioAllocationEntry, BaguioDispatch, BaguioDispatchAction } from "../../../../types/channel-sale";
import { getDispatchLocations } from "../_lib/dispatch-location";
import { printBaguioDispatchLoadSheet } from "../_lib/print-document";
import { getBaguioSaleStatusLabel } from "../_lib/workflow";
import { DispatchLocationMap } from "./DispatchLocationMap";
import { DispatchRoutePlan } from "./DispatchRoutePlan";
import { DispatchReconciliationReport } from "./DispatchReconciliationReport";
import { TripElapsedTimer } from "./TripElapsedTimer";

const progressSteps = ["Preparing", "Ready for driver", "In transit", "Completed"];
const pingDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
type DispatchTab = "original" | "current" | "map" | "reconciliation";

export function BaguioDispatchDetails({ dispatch, updating, onAdvance }: {
  dispatch: BaguioDispatch;
  updating: boolean;
  onAdvance: (id: string, action: BaguioDispatchAction) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<DispatchTab>("current");
  const locations = useMemo(() => getDispatchLocations(dispatch), [dispatch]);
  const canStart = dispatch.orders.length > 0 && dispatch.orders.every((order) => order.status === "loaded");
  const currentAllocation = dispatch.orders.flatMap((order) => order.items.map((item) => ({
    orderId: order.id,
    orderReferenceNumber: order.referenceNumber,
    clientName: order.clientName,
    productVariantId: item.productVariantId,
    productTitle: item.productTitle,
    variantLabel: item.variantLabel,
    quantity: item.quantity,
  })));

  return (
    <section className="mt-7 min-w-0">
      <a className="mb-5 flex w-max items-center gap-2 text-sm font-bold text-[var(--muted)] no-underline hover:underline" href="#baguio-sales"><ArrowLeft />Back to Baguio sales</a>
      <div className="min-w-0 border border-[var(--line)] bg-white p-5 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--line)] pb-6">
          <div>
            <p className="m-0 text-xs font-bold uppercase text-[var(--red)]">{dispatch.referenceNumber}</p>
            <h2 className="mb-1 mt-2 font-serif text-3xl">{dispatch.van.name}</h2>
            <p className="mb-1 mt-0 text-sm font-bold">Driver: {dispatch.driver?.name || "Unassigned"}</p>
            <p className="m-0 text-sm text-[var(--muted)]">{dispatch.orders.length} customer order{dispatch.orders.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Status value={dispatch.status} />
            <button className="secondary-button !w-full !px-3 justify-center sm:!w-auto" type="button" disabled={!dispatch.orders.length} onClick={() => printBaguioDispatchLoadSheet(dispatch)}><Printer />Print driver load sheet</button>
            {dispatch.status === "preparing" && <button className="primary-button compact-button !w-full justify-center sm:!w-auto" disabled={updating || !canStart} onClick={() => void onAdvance(dispatch.id, "start")}>Start dispatch</button>}
            {dispatch.status === "ready_for_departure" && <span className="text-xs font-bold text-[var(--muted)]">Waiting for driver to start trip</span>}
            {dispatch.status === "in_transit" && <TripElapsedTimer departedAt={dispatch.departedAt} />}
          </div>
        </header>
        <DispatchProgress status={dispatch.status} />
        <div className="mt-7 flex overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="Dispatch details">
          <DispatchTabButton id="original-allocation-tab" active={activeTab === "original"} controls="original-allocation-panel" onClick={() => setActiveTab("original")}>Original allocation</DispatchTabButton>
          <DispatchTabButton id="current-allocation-tab" active={activeTab === "current"} controls="current-allocation-panel" onClick={() => setActiveTab("current")}>{dispatch.status === "completed" ? "Post-delivery allocation" : "Current allocation"}</DispatchTabButton>
          <DispatchTabButton id="driver-map-tab" active={activeTab === "map"} controls="driver-map-panel" onClick={() => setActiveTab("map")}>Driver map</DispatchTabButton>
          <DispatchTabButton id="reconciliation-tab" active={activeTab === "reconciliation"} controls="reconciliation-panel" onClick={() => setActiveTab("reconciliation")}>Reconciliation</DispatchTabButton>
        </div>
        <div id="original-allocation-panel" role="tabpanel" aria-labelledby="original-allocation-tab" hidden={activeTab !== "original"}>
          <AllocationReport
            title="Pre-dispatch allocation"
            description="Original order allocation captured when the driver starts the trip."
            entries={dispatch.originalAllocation}
            orders={dispatch.orders.filter((order) => !order.addedAfterDeparture)}
            emptyMessage={["preparing", "ready_for_departure"].includes(dispatch.status) ? "This report will be captured when the driver starts the trip." : "No original allocation was recorded."}
          />
        </div>
        <div id="current-allocation-panel" role="tabpanel" aria-labelledby="current-allocation-tab" hidden={activeTab !== "current"}>
          <AllocationReport
            title={dispatch.status === "completed" ? "Post-delivery allocation" : "Current allocation"}
            description="Latest orders and item quantities after reallocations and additional clients."
            entries={currentAllocation}
            orders={dispatch.orders}
            emptyMessage="No inventory is allocated to this dispatch."
            showTags
          />
        </div>
        <div id="driver-map-panel" role="tabpanel" aria-labelledby="driver-map-tab" hidden={activeTab !== "map"}>
          {activeTab === "map" && <><DispatchRoutePlan dispatch={dispatch} /><DispatchLocationPins locations={locations} /></>}
        </div>
        <div id="reconciliation-panel" role="tabpanel" aria-labelledby="reconciliation-tab" hidden={activeTab !== "reconciliation"}>
          <DispatchReconciliationReport dispatch={dispatch} />
        </div>
      </div>
    </section>
  );
}

function DispatchLocationPins({ locations }: {
  locations: ReturnType<typeof getDispatchLocations>;
}) {
  if (!locations.length) {
    return (
      <section className="mt-5 rounded border border-dashed border-[var(--line)] p-4" aria-label="Latest driver location">
        <h3 className="m-0 text-sm">Latest driver ping</h3>
        <p className="mb-0 mt-1 text-xs text-[var(--muted)]">No location has been recorded yet. A pin will appear after the driver submits a signed delivery.</p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded border border-[var(--line)] bg-[var(--paper)] p-4" aria-label="Latest driver location">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f7e5e5] text-[var(--red)]"><MapPin className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm">Driver location pings</h3>
          <p className="mb-0 mt-1 text-xs text-[var(--muted)]">Numbered from the first recorded delivery to the most recent.</p>
        </div>
      </div>
      <DispatchLocationMap locations={locations} />
      <ol className="mb-0 mt-4 grid gap-2 p-0 sm:grid-cols-2">
        {locations.map((location, index) => <DispatchPingItem location={location} number={index + 1} key={location.orderId} />)}
      </ol>
    </section>
  );
}

function DispatchPingItem({ location, number }: {
  location: ReturnType<typeof getDispatchLocations>[number];
  number: number;
}) {
  const coordinates = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  return (
    <li className="flex min-w-0 gap-3 rounded border border-[var(--line)] bg-white p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--red)] text-xs font-bold text-white">{number}</span>
      <div className="min-w-0">
        <strong className="block truncate text-xs">{location.orderReferenceNumber} · {location.clientName}</strong>
        <span className="mt-0.5 block text-[10px] text-[var(--muted)]">{pingDate.format(new Date(location.signedAt))} · accuracy ±{Math.round(location.accuracy)} m</span>
        <a className="mt-1 block truncate font-mono text-[10px] font-bold text-[var(--red)] hover:underline" href={googleMapsUrl} target="_blank" rel="noreferrer">{coordinates}</a>
      </div>
    </li>
  );
}

function DispatchTabButton({ id, active, controls, onClick, children }: {
  id: string;
  active: boolean;
  controls: string;
  onClick: () => void;
  children: string;
}) {
  return <button id={id} className={`shrink-0 border-0 border-b-2 bg-transparent px-4 py-3 text-sm font-bold ${active ? "border-[var(--red)] text-[var(--red)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`} type="button" role="tab" aria-selected={active} aria-controls={controls} onClick={onClick}>{children}</button>;
}

function DispatchProgress({ status }: { status: BaguioDispatch["status"] }) {
  const activeIndex = status === "preparing" ? 0 : status === "ready_for_departure" ? 1 : status === "in_transit" ? 2 : status === "completed" ? 3 : -1;
  return (
    <section className="mt-6 border border-[var(--line)] p-5" aria-label="Dispatch progress">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="m-0 text-sm">Dispatch progress</h3>
        <p className="m-0 text-xs capitalize text-[var(--muted)]">Current step: {status.replaceAll("_", " ")}</p>
      </div>
      {status === "cancelled" ? <p className="mt-4 border-l-2 border-[var(--red)] bg-[#fae9e8] p-3 text-sm text-[#83151a]">This dispatch was cancelled.</p> : (
        <ol className="relative mt-6 grid grid-cols-4 p-0">
          <span className="absolute top-4 h-0.5 bg-[var(--line)]" style={{ left: "12.5%", right: "12.5%" }} aria-hidden="true" />
          <span className="absolute top-4 h-0.5 bg-[var(--red)] transition-[width]" style={{ left: "12.5%", width: `${Math.max(0, activeIndex) * 25}%` }} aria-hidden="true" />
          {progressSteps.map((step, index) => {
            const complete = status === "completed" || index < activeIndex;
            const current = index === activeIndex && status !== "completed";
            return (
              <li className={`relative z-1 grid justify-items-center gap-2 text-center text-xs ${complete || current ? "text-[var(--ink)]" : "text-[#9a978f]"}`} aria-current={current ? "step" : undefined} key={step}>
                <span className={`grid size-8 place-items-center rounded-full border-2 font-bold ${complete ? "border-[var(--red)] bg-[var(--red)] text-white" : current ? "border-[var(--red)] bg-white text-[var(--red)]" : "border-[var(--line)] bg-white"}`}>{complete ? <Check className="size-4" /> : index + 1}</span>
                <strong>{step}</strong>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AllocationReport({ title, description, entries, orders, emptyMessage, showTags = false }: {
  title: string;
  description: string;
  entries: BaguioAllocationEntry[];
  orders: BaguioDispatch["orders"];
  emptyMessage: string;
  showTags?: boolean;
}) {
  return (
    <section className="mt-7 min-w-0">
      <header><h3 className="m-0 text-base">{title}</h3><p className="mb-0 mt-1 text-xs text-[var(--muted)]">{description}</p></header>
      {!entries.length ? <p className="mt-4 border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">{emptyMessage}</p> : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead><tr className="bg-[var(--paper)]"><th className="border border-[var(--line)] p-3 text-left">Order</th><th className="border border-[var(--line)] p-3 text-left">Client</th><th className="border border-[var(--line)] p-3 text-left">Tracking</th><th className="border border-[var(--line)] p-3 text-left">Items for this order</th></tr></thead>
              <tbody>{orders.map((order) => <OrderAllocationRow order={order} entries={entries.filter((entry) => entry.orderId === order.id)} showTags={showTags} key={order.id} />)}</tbody>
            </table>
          </div>
          <ProductSummary entries={entries} />
        </>
      )}
    </section>
  );
}

function OrderAllocationRow({ order, entries, showTags }: {
  order: BaguioDispatch["orders"][number];
  entries: BaguioAllocationEntry[];
  showTags: boolean;
}) {
  return (
    <tr className="align-top">
      <td className="border border-[var(--line)] p-3"><a className="font-bold text-[var(--red)]" href={`#baguio-sales/${order.id}`}>{order.referenceNumber}</a></td>
      <td className="border border-[var(--line)] p-3 font-bold">{order.clientName}</td>
      <td className="border border-[var(--line)] p-3"><span className="text-xs font-bold uppercase">{showTags ? getBaguioSaleStatusLabel(order.status) : "Original allocation"}</span>{showTags && <OrderTags order={order} />}</td>
      <td className="border border-[var(--line)] p-0">
        <table className="w-full min-w-[300px] border-collapse text-xs" aria-label={`${order.referenceNumber} items`}>
          <thead><tr className="text-[var(--muted)]"><th className="border-b border-[var(--line)] p-3 text-left">Product</th><th className="border-b border-[var(--line)] p-3 text-left">Variant</th><th className="border-b border-[var(--line)] p-3 text-right">Qty</th></tr></thead>
          <tbody>{entries.map((entry) => <tr className="border-b border-[var(--line)] last:border-0" key={entry.productVariantId}><td className="p-3 font-bold">{entry.productTitle}</td><td className="p-3">{entry.variantLabel}</td><td className="p-3 text-right font-bold">{entry.quantity}</td></tr>)}</tbody>
        </table>
      </td>
    </tr>
  );
}

function ProductSummary({ entries }: { entries: BaguioAllocationEntry[] }) {
  const products = [...new Map(entries.map((entry) => [entry.productVariantId, entry])).values()];
  return (
    <div className="mt-5 overflow-x-auto">
      <h4 className="m-0 mb-3 text-sm">Product quantity summary</h4>
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead><tr className="bg-[var(--paper)]"><th className="border border-[var(--line)] p-3 text-left">Product</th><th className="border border-[var(--line)] p-3 text-left">Variant</th><th className="border border-[var(--line)] p-3 text-right">Quantity sold</th></tr></thead>
        <tbody>{products.map((product) => <tr key={product.productVariantId}><td className="border border-[var(--line)] p-3 font-bold">{product.productTitle}</td><td className="border border-[var(--line)] p-3">{product.variantLabel}</td><td className="border border-[var(--line)] p-3 text-right font-bold">{entries.filter((entry) => entry.productVariantId === product.productVariantId).reduce((sum, entry) => sum + entry.quantity, 0)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function OrderTags({ order }: { order: BaguioDispatch["orders"][number] }) {
  return <span className="mt-2 flex flex-wrap gap-1">{order.addedAfterDeparture && <Tag value="Added in transit" />}{order.revisionCount > 0 && <Tag value="Changed" />}</span>;
}

function Tag({ value }: { value: string }) { return <span className="rounded-full bg-[#fff0c7] px-2 py-1 text-[10px] font-bold uppercase text-[#785000]">{value}</span>; }

function Status({ value }: { value: BaguioDispatch["status"] }) { return <span className="self-start rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)] sm:self-auto">{value.replaceAll("_", " ")}</span>; }
