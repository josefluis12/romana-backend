export type BaguioSalesSubview = "drivers" | "new-order" | "new-dispatch" | "new-driver";

export function readSelectedBaguioSaleId(hash: string): string | null {
  if (hash === "#baguio-sales/dispatches") return null;
  if (readBaguioSalesSubview(hash)) return null;
  return hash.match(/^#baguio-sales\/([^/]+)$/)?.[1] ?? null;
}

export function readSelectedBaguioDispatchId(hash: string): string | null {
  return hash.match(/^#baguio-sales\/dispatches\/([^/]+)$/)?.[1] ?? null;
}

export function readBaguioSalesSubview(hash: string): BaguioSalesSubview | null {
  const subview = hash.match(/^#baguio-sales\/(drivers|new-order|new-dispatch|new-driver)$/)?.[1];
  return subview ? subview as BaguioSalesSubview : null;
}
