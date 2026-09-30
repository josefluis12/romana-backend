import type { BaguioDispatch } from "../../../../types/channel-sale";

export function printBaguioDispatchLoadSheet(dispatch: BaguioDispatch): void {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to print this document.");
  popup.opener = null;
  popup.document.write(buildBaguioDispatchLoadSheetHtml(dispatch));
  popup.document.close();
}

export function buildBaguioDispatchLoadSheetHtml(dispatch: BaguioDispatch): string {
  const stops = dispatch.orders.map((order, index) => {
    const items = order.items.map((item) => `<div><b>${item.quantity}×</b> ${escapeHtml(item.productTitle)} <small>${escapeHtml(item.variantLabel)}</small></div>`).join("");
    const notes = order.deliveryNotes ? `<small class="notes">Note: ${escapeHtml(order.deliveryNotes)}</small>` : "";
    return `<tr><td class="stop-number">${index + 1}</td><td><b>${escapeHtml(order.referenceNumber)}</b><br>${escapeHtml(order.clientName)}</td><td><b>${escapeHtml(order.clientAddress || "No address recorded")}</b><br><small>${escapeHtml(order.clientPhone || "—")}</small>${notes}</td><td class="items">${items}</td><td class="check">□</td></tr>`;
  }).join("");
  const totals = summarizeDispatchProducts(dispatch).map((item) => `<b>${item.quantity}×</b> ${escapeHtml(item.productTitle)} <small>${escapeHtml(item.variantLabel)}</small>`).join(" · ");
  const units = dispatch.orders.flatMap((order) => order.items).reduce((sum, item) => sum + item.quantity, 0);
  return `<!doctype html><html><head><title>Driver Load Sheet ${escapeHtml(dispatch.referenceNumber)}</title><style>
    @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font:9px Arial,sans-serif;color:#20201e;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c82028;padding-bottom:6px}h1{font:21px Georgia,serif;margin:0}small,.muted{color:#666;font-size:8px}.meta{display:flex;gap:22px;margin:7px 0}.meta span{color:#666}.load{border:1px solid #bbb;padding:6px;margin-bottom:7px;line-height:1.5}.load strong{margin-right:8px}.dispatch-note{margin:0 0 7px}.route{width:100%;border-collapse:collapse;table-layout:fixed}.route thead{display:table-header-group}.route tr{break-inside:avoid}.route th,.route td{border:1px solid #aaa;padding:5px;vertical-align:top;text-align:left;line-height:1.25}.route th{background:#f1eee7;font-size:8px;text-transform:uppercase}.route th:nth-child(1){width:4%}.route th:nth-child(2){width:17%}.route th:nth-child(3){width:35%}.route th:nth-child(4){width:39%}.route th:nth-child(5){width:5%}.stop-number,.check{text-align:center!important;font-size:14px}.items div{display:inline-block;margin-right:10px}.notes{display:block;margin-top:3px}.footer{display:flex;justify-content:space-between;margin-top:12px;border-top:1px solid #777;padding-top:5px}@media print{body{margin:0}}
  </style></head><body><header><div><h1>Driver Load Sheet</h1><small>ROMANA PEANUT BRITTLE · DELIVERY MANIFEST</small></div><strong>${escapeHtml(dispatch.referenceNumber)}</strong></header>
  <section class="meta"><span><b>Vehicle:</b> ${escapeHtml(dispatch.van.name)}</span><span><b>Driver:</b> ${escapeHtml(dispatch.driver?.name || "Unassigned")}</span><span><b>Stops:</b> ${dispatch.orders.length}</span><span><b>Units:</b> ${units}</span></section>
  <section class="load"><strong>LOAD SUMMARY</strong>${totals || "No products assigned"}</section>
  ${dispatch.notes ? `<p class="dispatch-note"><b>Dispatch note:</b> ${escapeHtml(dispatch.notes)}</p>` : ""}
  ${stops ? `<table class="route"><thead><tr><th>#</th><th>Order / Customer</th><th>Destination / Contact</th><th>Items to unload</th><th>Done</th></tr></thead><tbody>${stops}</tbody></table>` : '<p class="muted">No orders are assigned to this dispatch.</p>'}
  <footer class="footer"><span>Driver: ______________________________</span><span>Verified by: ______________________________</span></footer>
  <script>window.addEventListener('load',()=>window.print())</script></body></html>`;
}

function summarizeDispatchProducts(dispatch: BaguioDispatch) {
  const products = new Map<string, { productTitle: string; variantLabel: string; quantity: number }>();
  for (const item of dispatch.orders.flatMap((order) => order.items)) {
    const current = products.get(item.productVariantId);
    products.set(item.productVariantId, {
      productTitle: item.productTitle,
      variantLabel: item.variantLabel,
      quantity: (current?.quantity || 0) + item.quantity,
    });
  }
  return [...products.values()];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
