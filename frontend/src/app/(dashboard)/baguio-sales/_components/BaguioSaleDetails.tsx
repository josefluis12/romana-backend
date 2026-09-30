import { useState } from "react";
import { ArrowLeft, Check, FileText, MapPin, Pencil, Phone, Printer } from "lucide-react";
import type { BaguioSale, BaguioSaleAction, BaguioSaleUpdateInput } from "../../../../types/channel-sale";
import type { Product } from "../../../../types/product";
import type { BaguioDocumentKind } from "../_lib/continuous-form-pdf";
import { baguioSaleProgressStages, getBaguioSaleProgressStage, getBaguioSaleStatusLabel } from "../_lib/workflow";
import { BaguioDocumentInlinePreview, BaguioDocumentPreview } from "./BaguioDocumentPreview";
import { BaguioSaleEditor } from "./BaguioSaleEditor";

const orderDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const actionByStatus: Partial<Record<BaguioSale["status"], { action: BaguioSaleAction; label: string }>> = {
  draft: { action: "submit", label: "Submit for approval" },
  pending_approval: { action: "approve", label: "Confirm manual approval" },
  approved: { action: "load", label: "Confirm van loading" },
  in_transit: { action: "deliver", label: "Mark delivered" },
  delivered: { action: "complete", label: "Confirm signed DR and success" },
};

interface BaguioSaleDetailsProps {
  sale: BaguioSale;
  products: Product[];
  updating: boolean;
  onAdvance: (action: BaguioSaleAction) => Promise<void>;
  onUpdate: (input: BaguioSaleUpdateInput) => Promise<boolean>;
}

export function BaguioSaleDetails({ sale, products, updating, onAdvance, onUpdate }: BaguioSaleDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState<BaguioDocumentKind | null>(null);
  const [inlineDocument, setInlineDocument] = useState<BaguioDocumentKind>("delivery-order");
  const nextAction = actionByStatus[sale.status];
  const editable = !["delivered", "successful", "cancelled"].includes(sale.status);

  return (
    <section className="mt-7">
      <a className="mb-5 flex w-max items-center gap-2 text-sm font-bold text-[var(--muted)] no-underline hover:text-[var(--red)]" href="#baguio-sales">
        <ArrowLeft className="size-4" />Back to Baguio sales
      </a>
      <article className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm">
        <header className="flex flex-col gap-5 border-b border-[var(--line)] px-5 py-6 sm:px-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="m-0 font-mono text-xs font-bold uppercase tracking-wide text-[var(--red)]">{sale.referenceNumber}</p>
              <Status value={sale.status} />
            </div>
            <h2 className="mb-1 mt-3 font-serif text-3xl leading-tight">{sale.clientName}</h2>
            <p className="m-0 text-sm text-[var(--muted)]">Created {orderDate.format(new Date(sale.createdAt))}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {editable && <button className="secondary-button" type="button" disabled={updating} onClick={() => setEditing(true)}><Pencil />Edit order</button>}
            {nextAction && <button className="primary-button compact-button" type="button" disabled={updating} onClick={() => void onAdvance(nextAction.action)}>{updating ? "Updating…" : nextAction.label}</button>}
          </div>
        </header>

        <div className="px-5 py-6 sm:px-7">
          <BaguioSaleProgress status={sale.status} />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
            <section className="overflow-hidden rounded-md border border-[var(--line)]" aria-labelledby="document-preview-title">
              <header className="bg-[var(--paper)] px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="m-0 text-sm" id="document-preview-title">Print document preview</h3><p className="m-0 mt-1 font-mono text-xs text-[var(--muted)]">{inlineDocument === "delivery-order" ? sale.deliveryOrder.number : sale.deliveryReceipt.number} · 9.5 × 11 in continuous paper</p></div>
                  <button className="grid size-9 shrink-0 place-items-center rounded border border-[var(--line)] bg-white text-[var(--red)] hover:border-[var(--red)]" type="button" onClick={() => setPreviewing(inlineDocument)} aria-label={`Open ${inlineDocument === "delivery-order" ? "delivery order form" : "delivery receipt"} PDF`} title="Open PDF"><Printer className="size-4" /></button>
                </div>
                <div className="mt-3 flex gap-2" role="tablist" aria-label="Printable order documents">
                  <DocumentTab active={inlineDocument === "delivery-order"} onClick={() => setInlineDocument("delivery-order")}>Delivery order form</DocumentTab>
                  <DocumentTab active={inlineDocument === "delivery-receipt"} onClick={() => setInlineDocument("delivery-receipt")}>Delivery receipt</DocumentTab>
                </div>
              </header>
              <BaguioDocumentInlinePreview sale={sale} kind={inlineDocument} />
            </section>

            <aside className="grid gap-4">
              <section className="rounded-md border border-[var(--line)] p-4">
                <h3 className="m-0 text-sm">Delivery details</h3>
                <Detail icon={<MapPin />} label="Address" value={sale.clientAddress || "No address recorded"} />
                <Detail icon={<Phone />} label="Phone" value={sale.clientPhone || "No phone recorded"} />
                <dl className="mb-0 mt-4 grid gap-3 border-t border-dashed border-[var(--line)] pt-4">
                  <Data label="Destination inventory" value={sale.van.name} />
                  <Data label="Prepared by" value={sale.deliveryOrder.preparedByName} />
                </dl>
              </section>
              <DocumentCard title="Delivery Receipt" number={sale.deliveryReceipt.number} status={sale.deliveryReceipt.status} onPreview={() => setPreviewing("delivery-receipt")} />
            </aside>
          </div>
          {sale.deliveryNotes && <div className="mt-6 rounded-r border-l-3 border-[var(--red)] bg-[var(--paper)] p-4"><strong className="text-sm">Delivery notes</strong><p className="mb-0 mt-1 text-sm text-[var(--muted)]">{sale.deliveryNotes}</p></div>}
        </div>
      </article>
      {editing && <BaguioSaleEditor sale={sale} products={products} submitting={updating} onClose={() => setEditing(false)} onSubmit={onUpdate} />}
      {previewing && <BaguioDocumentPreview sale={sale} kind={previewing} onClose={() => setPreviewing(null)} />}
    </section>
  );
}

function BaguioSaleProgress({ status }: { status: BaguioSale["status"] }) {
  const activeStage = getBaguioSaleProgressStage(status);
  return (
    <section className="rounded-md border border-[var(--line)] p-4 sm:p-5" aria-label="Baguio order progress">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5"><h3 className="m-0 text-sm">Order progress</h3><p className="m-0 text-xs text-[var(--muted)]">Current step: {getBaguioSaleStatusLabel(status)}</p></div>
      {status === "cancelled" ? <p className="mt-4 border-l-3 border-[var(--red)] bg-[#fae9e8] p-3 text-sm text-[#83151a]">Tracking stopped because this order was cancelled.</p> : (
        <ol className="relative mt-6 grid grid-cols-4 p-0">
          <span className="absolute top-4 h-0.5 bg-[var(--line)]" style={{ left: "12.5%", right: "12.5%" }} aria-hidden="true" />
          <span className="absolute top-4 h-0.5 bg-[var(--red)]" style={{ left: "12.5%", width: `${activeStage * 25}%` }} aria-hidden="true" />
          {baguioSaleProgressStages.map((stage, index) => {
            const complete = index < activeStage || status === "successful";
            const current = index === activeStage && status !== "successful";
            return <li className={`relative z-1 grid justify-items-center gap-2 text-center text-[10px] sm:text-xs ${complete || current ? "text-[var(--ink)]" : "text-[#9a978f]"}`} key={stage} aria-current={current ? "step" : undefined}><span className={`grid size-8 place-items-center rounded-full border-2 font-bold ${complete ? "border-[var(--red)] bg-[var(--red)] text-white" : current ? "border-[var(--red)] bg-white text-[var(--red)]" : "border-[var(--line)] bg-white"}`}>{complete ? <Check className="size-4" /> : index + 1}</span><strong>{stage}</strong></li>;
          })}
        </ol>
      )}
    </section>
  );
}

function DocumentCard({ title, number, status, onPreview }: { title: string; number: string; status?: string; onPreview: () => void }) {
  return (
    <article className="flex items-center gap-3 rounded-md border border-[var(--line)] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded bg-[#f7e5e5] text-[var(--red)]"><FileText className="size-5" /></span>
      <div className="min-w-0 flex-1"><h3 className="m-0 text-sm">{title}</h3><p className="m-0 mt-1 truncate font-mono text-xs text-[var(--muted)]">{number}{status ? ` · ${status.replaceAll("_", " ")}` : ""}</p></div>
      <button className="grid size-9 shrink-0 place-items-center rounded border border-[var(--line)] bg-white text-[var(--red)] hover:border-[var(--red)]" type="button" onClick={onPreview} aria-label={`Preview ${title} PDF`} title="Preview PDF"><Printer className="size-4" /></button>
    </article>
  );
}

function DocumentTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`rounded border px-3 py-2 text-xs font-bold ${active ? "border-[var(--red)] bg-white text-[var(--red)]" : "border-[var(--line)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`} type="button" role="tab" aria-selected={active} onClick={onClick}>{children}</button>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="mt-4 flex gap-3 text-sm"><span className="mt-0.5 text-[var(--muted)] [&>svg]:size-4">{icon}</span><div><span className="block text-xs text-[var(--muted)]">{label}</span><strong className="mt-0.5 block leading-snug">{value}</strong></div></div>;
}

function Data({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="m-0 mt-1 text-sm font-bold">{value}</dd></div>;
}

function Status({ value }: { value: BaguioSale["status"] }) {
  return <span className="rounded-full bg-[#f7e5e5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--red)]">{getBaguioSaleStatusLabel(value)}</span>;
}
