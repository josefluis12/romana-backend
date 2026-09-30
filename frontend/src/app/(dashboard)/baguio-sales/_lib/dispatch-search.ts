import type { BaguioDispatch } from "../../../../types/channel-sale";

export function matchesBaguioDispatchSearch(dispatch: BaguioDispatch, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  const searchableValues = [
    dispatch.referenceNumber,
    dispatch.van.name,
    dispatch.van.code,
    dispatch.driver?.name || "",
    dispatch.driver?.email || "",
    dispatch.status.replaceAll("_", " "),
    dispatch.notes,
    ...dispatch.orders.flatMap((order) => [
      order.referenceNumber,
      order.clientName,
      ...order.items.flatMap((item) => [item.productTitle, item.variantLabel]),
    ]),
  ];

  return searchableValues.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}
