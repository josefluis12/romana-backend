export type BaguioSalesSubview = "new-order" | "new-dispatch";

export function readSelectedBaguioSaleId(hash: string): string | null {
  if (hash === "#baguio-sales/dispatches") return null;
  if (hash === "#baguio-sales/drivers" || hash === "#baguio-sales/new-driver") return null;
  if (readBaguioSalesSubview(hash)) return null;
  return hash.match(/^#baguio-sales\/([^/]+)$/)?.[1] ?? null;
}

export function readSelectedBaguioDispatchId(hash: string): string | null {
  return hash.match(/^#baguio-sales\/dispatches\/([^/]+)$/)?.[1] ?? null;
}

export function readBaguioSalesSubview(hash: string): BaguioSalesSubview | null {
  const subview = hash.match(/^#baguio-sales\/(new-order|new-dispatch)$/)?.[1];
  return subview ? subview as BaguioSalesSubview : null;
}
