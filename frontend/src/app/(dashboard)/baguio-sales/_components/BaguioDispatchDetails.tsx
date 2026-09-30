import { useState } from "react";
import { ArrowLeft, Check, Printer } from "lucide-react";
import type { BaguioAllocationEntry, BaguioDispatch, BaguioDispatchAction } from "../../../../types/channel-sale";
import { printBaguioDispatchLoadSheet } from "../_lib/print-document";
import { getBaguioSaleStatusLabel } from "../_lib/workflow";

const progressSteps = ["Preparing", "In transit", "Completed"];
type AllocationTab = "original" | "current";

export function BaguioDispatchDetails({ dispatch, updating, onAdvance }: {
  dispatch: BaguioDispatch;
  updating: boolean;
  onAdvance: (id: string, action: BaguioDispatchAction) => Promise<void>;
}) {
  const [allocationTab, setAllocationTab] = useState<AllocationTab>("current");
  const canStart = dispatch.orders.length > 0 && dispatch.orders.every((order) => order.status === "loaded");
  const canComplete = dispatch.orders.length > 0 && dispatch.orders.every((order) => order.status === "delivered" || order.status === "successful");
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
          <div className="flex flex-wrap items-center gap-3">
            <Status value={dispatch.status} />
            <button className="secondary-button" type="button" disabled={!dispatch.orders.length} onClick={() => printBaguioDispatchLoadSheet(dispatch)}><Printer />Print driver load sheet</button>
            {dispatch.status === "preparing" && <button className="primary-button compact-button" disabled={updating || !canStart} onClick={() => void onAdvance(dispatch.id, "start")}>Start dispatch</button>}
            {dispatch.status === "in_transit" && <button className="primary-button compact-button" disabled={updating || !canComplete} onClick={() => void onAdvance(dispatch.id, "complete")}>Complete dispatch</button>}
          </div>
        </header>
        <DispatchProgress status={dispatch.status} />
        <div className="mt-7 flex border-b border-[var(--line)]" role="tablist" aria-label="Dispatch allocation reports">
          <AllocationTabButton id="original-allocation-tab" active={allocationTab === "original"} controls="original-allocation-panel" onClick={() => setAllocationTab("original")}>Original allocation</AllocationTabButton>
          <AllocationTabButton id="current-allocation-tab" active={allocationTab === "current"} controls="current-allocation-panel" onClick={() => setAllocationTab("current")}>{dispatch.status === "completed" ? "Post-delivery allocation" : "Current allocation"}</AllocationTabButton>
        </div>
        <div id="original-allocation-panel" role="tabpanel" aria-labelledby="original-allocation-tab" hidden={allocationTab !== "original"}>
          <AllocationReport
            title="Pre-dispatch allocation"
            description="Original order allocation captured when the dispatch entered transit."
            entries={dispatch.originalAllocation}
            orders={dispatch.orders.filter((order) => !order.addedAfterDeparture)}
            emptyMessage={dispatch.status === "preparing" ? "This report will be captured when the dispatch starts." : "No original allocation was recorded."}
          />
        </div>
        <div id="current-allocation-panel" role="tabpanel" aria-labelledby="current-allocation-tab" hidden={allocationTab !== "current"}>
          <AllocationReport
            title={dispatch.status === "completed" ? "Post-delivery allocation" : "Current allocation"}
            description="Latest orders and item quantities after reallocations and additional clients."
            entries={currentAllocation}
            orders={dispatch.orders}
            emptyMessage="No inventory is allocated to this dispatch."
            showTags
          />
        </div>
      </div>
    </section>
  );
}

function AllocationTabButton({ id, active, controls, onClick, children }: {
  id: string;
  active: boolean;
  controls: string;
  onClick: () => void;
  children: string;
}) {
  return <button id={id} className={`border-0 border-b-2 bg-transparent px-4 py-3 text-sm font-bold ${active ? "border-[var(--red)] text-[var(--red)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`} type="button" role="tab" aria-selected={active} aria-controls={controls} onClick={onClick}>{children}</button>;
}

function DispatchProgress({ status }: { status: BaguioDispatch["status"] }) {
  const activeIndex = status === "preparing" ? 0 : status === "in_transit" ? 1 : status === "completed" ? 2 : -1;
  return (
    <section className="mt-6 border border-[var(--line)] p-5" aria-label="Dispatch progress">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="m-0 text-sm">Dispatch progress</h3>
        <p className="m-0 text-xs capitalize text-[var(--muted)]">Current step: {status.replaceAll("_", " ")}</p>
      </div>
      {status === "cancelled" ? <p className="mt-4 border-l-2 border-[var(--red)] bg-[#fae9e8] p-3 text-sm text-[#83151a]">This dispatch was cancelled.</p> : (
        <ol className="relative mt-6 grid grid-cols-3 p-0">
          <span className="absolute top-4 h-0.5 bg-[var(--line)]" style={{ left: "16.666%", right: "16.666%" }} aria-hidden="true" />
          <span className="absolute top-4 h-0.5 bg-[var(--red)] transition-[width]" style={{ left: "16.666%", width: activeIndex === 0 ? "0" : activeIndex === 1 ? "33.334%" : "66.668%" }} aria-hidden="true" />
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

function Status({ value }: { value: BaguioDispatch["status"] }) { return <span className="rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)]">{value.replaceAll("_", " ")}</span>; }
