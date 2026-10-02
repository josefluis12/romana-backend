import type { BaguioClient } from "../../../../types/channel-sale";
import type { Product } from "../../../../types/product";

export interface ProductVariantOption {
  id: string;
  label: string;
  price: number;
  productTitle: string;
  searchText: string;
}

const MAX_VISIBLE_OPTIONS = 50;

export function searchCustomers(clients: BaguioClient[], query: string, selectedId = ""): BaguioClient[] {
  const search = normalize(query);
  const matches = clients
    .filter((client) => client.isActive)
    .filter((client) => !search || normalize([
      client.name,
      client.referenceNumber,
      client.contactPerson,
      client.phone,
      client.email,
    ].join(" ")).includes(search));
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const selected = clients.find((client) => client.isActive && client.id === selectedId);
  return selected && !visible.some((client) => client.id === selected.id)
    ? [selected, ...visible.slice(0, MAX_VISIBLE_OPTIONS - 1)]
    : visible;
}

export function createVariantOptions(products: Product[]): ProductVariantOption[] {
  return products.flatMap((product) => product.variants.map((variant) => ({
    ...variant,
    productTitle: product.title,
    searchText: normalize(`${product.title} ${product.slug} ${product.category} ${variant.label}`),
  }))).sort((left, right) => (
    `${left.productTitle} ${left.label}`.localeCompare(`${right.productTitle} ${right.label}`)
  ));
}

export function searchVariants(
  variants: ProductVariantOption[],
  query: string,
  selectedId: string,
): ProductVariantOption[] {
  const search = normalize(query);
  const matches = variants.filter((variant) => !search || variant.searchText.includes(search));
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const selected = variants.find((variant) => variant.id === selectedId);
  return selected && !visible.some((variant) => variant.id === selected.id)
    ? [selected, ...visible.slice(0, MAX_VISIBLE_OPTIONS - 1)]
    : visible;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
