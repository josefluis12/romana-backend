import type { BaguioSale } from "../../../../types/channel-sale";

export function matchesBaguioOrderSearch(order: BaguioSale, query: string, statusLabel = ""): boolean {
  const searchTerm = normalizeSearchText(query);
  if (!searchTerm) return true;

  const searchableText = [
    order.referenceNumber,
    order.clientName,
    order.clientAddress,
    order.clientPhone,
    order.deliveryOrder.number,
    order.deliveryReceipt.number,
    order.status.replaceAll("_", " "),
    statusLabel,
    ...order.items.flatMap((item) => [item.productTitle, item.variantLabel]),
  ].join(" ");

  return normalizeSearchText(searchableText).includes(searchTerm);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase("en-PH");
}
