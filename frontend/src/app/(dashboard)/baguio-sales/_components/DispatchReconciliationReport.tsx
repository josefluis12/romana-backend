import type { BaguioDispatch } from "../../../../types/channel-sale";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export function DispatchReconciliationReport({ dispatch }: { dispatch: BaguioDispatch }) {
  const report = dispatch.reconciliation;
  if (!report) return <p className="mt-5 border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">The driver has not submitted a trip reconciliation yet.</p>;
  const delivered = report.orders.filter((order) => order.outcome === "delivered");
  const failed = report.orders.filter((order) => order.outcome === "failed");
  return <section className="mt-6" aria-label="Trip reconciliation">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Delivered orders" value={String(delivered.length)} />
      <Metric label="Failed orders" value={String(failed.length)} />
      <Metric label="Collected payments" value={peso.format(report.totalCollected)} />
    </div>
    <p className="mt-3 text-xs text-[var(--muted)]">Submitted {date.format(new Date(report.submittedAt))}</p>
    <h3 className="mb-3 mt-6 text-sm">Order reconciliation</h3>
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-sm">
      <thead><tr className="bg-[var(--paper)]"><th className="border border-[var(--line)] p-3 text-left">Order</th><th className="border border-[var(--line)] p-3 text-left">Outcome</th><th className="border border-[var(--line)] p-3 text-right">Collected</th><th className="border border-[var(--line)] p-3 text-left">Failure reason</th></tr></thead>
      <tbody>{report.orders.map((result) => {
        const order = dispatch.orders.find((candidate) => candidate.id === result.orderId);
        return <tr key={result.orderId}><td className="border border-[var(--line)] p-3 font-bold">{order?.referenceNumber ?? result.orderId}</td><td className="border border-[var(--line)] p-3 capitalize">{result.outcome}</td><td className="border border-[var(--line)] p-3 text-right">{peso.format(result.collectedAmount)}</td><td className="border border-[var(--line)] p-3">{result.failureReason || "—"}</td></tr>;
      })}</tbody>
    </table></div>
    <h3 className="mb-3 mt-6 text-sm">Inventory reconciliation</h3>
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-sm">
      <thead><tr className="bg-[var(--paper)]"><th className="border border-[var(--line)] p-3 text-left">Product</th><th className="border border-[var(--line)] p-3 text-right">Loaded</th><th className="border border-[var(--line)] p-3 text-right">Delivered</th><th className="border border-[var(--line)] p-3 text-right">Returned</th><th className="border border-[var(--line)] p-3 text-right">Damaged</th><th className="border border-[var(--line)] p-3 text-right">Missing</th><th className="border border-[var(--line)] p-3 text-right">Remaining</th></tr></thead>
      <tbody>{report.inventory.map((item) => <tr key={item.productVariantId}><td className="border border-[var(--line)] p-3"><strong>{item.productTitle}</strong><span className="block text-xs text-[var(--muted)]">{item.variantLabel}</span></td><NumberCell value={item.allocatedQuantity} /><NumberCell value={item.deliveredQuantity} /><NumberCell value={item.returnedQuantity} /><NumberCell value={item.damagedQuantity} /><NumberCell value={item.missingQuantity} /><NumberCell value={item.remainingQuantity} strong /></tr>)}</tbody>
    </table></div>
    {report.notes && <div className="mt-5 border-l-2 border-[var(--red)] bg-[var(--paper)] p-4"><strong className="text-sm">Driver notes</strong><p className="mb-0 mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{report.notes}</p></div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--line)] bg-[var(--paper)] p-4"><span className="block text-xs text-[var(--muted)]">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>; }
function NumberCell({ value, strong = false }: { value: number; strong?: boolean }) { return <td className={`border border-[var(--line)] p-3 text-right ${strong ? "font-bold" : ""}`}>{value}</td>; }
