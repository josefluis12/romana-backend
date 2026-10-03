import { useState, type FormEvent } from "react";
import { Minus, Plus } from "lucide-react";
import type { Product } from "../../../../types/product";
import type { BaguioClient, BaguioDispatch, BaguioSaleInput } from "../../../../types/channel-sale";
import { createVariantOptions, searchCustomers, searchVariants } from "../_lib/order-option-search";
import { SearchCombobox, type ComboboxOption } from "./SearchCombobox";

interface Props {
  products: Product[];
  dispatches: BaguioDispatch[];
  clients: BaguioClient[];
  preparedByName: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: BaguioSaleInput) => Promise<void>;
}

interface ItemDraft { productVariantId: string; quantity: number; unitPrice: number }

export function BaguioSaleForm({ products, dispatches, clients, preparedByName, submitting, onCancel, onSubmit }: Props) {
  const variants = createVariantOptions(products);
  const firstVariant = variants[0];
  const firstCustomer = clients.find((client) => client.isActive);
  const [customerId, setCustomerId] = useState(firstCustomer?.id || "");
  const [customerQuery, setCustomerQuery] = useState(firstCustomer ? customerLabel(firstCustomer) : "");
  const [customerAddressId, setCustomerAddressId] = useState(defaultAddressId(firstCustomer));
  const [productQueries, setProductQueries] = useState<string[]>(firstVariant ? [variantLabel(firstVariant)] : [""]);
  const openDispatches = dispatches.filter((dispatch) => dispatch.status === "preparing" || dispatch.status === "in_transit");
  const [dispatchId, setDispatchId] = useState(openDispatches[0]?.id || "");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(firstVariant ? [{ productVariantId: firstVariant.id, quantity: 1, unitPrice: firstVariant.price }] : []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerAddressId) return;
    await onSubmit({ customerId, customerAddressId, dispatchId, deliveryNotes, items });
  }

  function updateVariant(index: number, id: string) {
    const variant = variants.find((candidate) => candidate.id === id);
    if (!variant) return;
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productVariantId: id, unitPrice: variant.price } : item));
  }

  function chooseCustomer(value: string) {
    setCustomerQuery(value);
    const customer = clients.find((client) => customerLabel(client) === value && client.isActive);
    setCustomerId(customer?.id || "");
    setCustomerAddressId(defaultAddressId(customer));
  }

  function selectCustomer(option: ComboboxOption) {
    const customer = clients.find((client) => client.id === option.id);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerQuery(customerLabel(customer));
    setCustomerAddressId(defaultAddressId(customer));
  }

  function chooseVariant(index: number, value: string) {
    setProductQueries((current) => current.map((query, itemIndex) => itemIndex === index ? value : query));
    const variant = variants.find((candidate) => variantLabel(candidate) === value);
    if (variant) updateVariant(index, variant.id);
    else setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productVariantId: "" } : item));
  }

  function selectVariant(index: number, option: ComboboxOption) {
    const variant = variants.find((candidate) => candidate.id === option.id);
    if (!variant) return;
    setProductQueries((current) => current.map((query, itemIndex) => itemIndex === index ? variantLabel(variant) : query));
    updateVariant(index, variant.id);
  }

  function updateItem(index: number, update: Partial<ItemDraft>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  }

  function addItem() {
    const available = variants.find((variant) => !items.some((item) => item.productVariantId === variant.id));
    if (!available) return;
    setItems((current) => [...current, { productVariantId: available.id, quantity: 1, unitPrice: available.price }]);
    setProductQueries((current) => [...current, variantLabel(available)]);
  }

  const visibleCustomers = searchCustomers(clients, customerQuery, customerId);
  const selectedCustomer = clients.find((client) => client.id === customerId);

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setProductQueries((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <form className="mt-6 border border-[var(--line)] bg-white p-5 sm:p-8" onSubmit={(event) => void submit(event)}>
      <div className="grid items-start gap-4 border-b border-[var(--line)] pb-5 sm:flex sm:flex-wrap sm:justify-between">
        <div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">New Baguio order</p><h2 className="mt-1 font-serif text-2xl">Create the DOF and pending DR</h2></div>
        <button className="secondary-button shrink-0 justify-self-start" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <SearchCombobox id="registered-customer" label="Registered customer" wide value={customerQuery} options={visibleCustomers.map((client) => ({ id: client.id, label: customerLabel(client) }))} placeholder="Search name, reference, contact, phone, or email" onChange={chooseCustomer} onSelect={selectCustomer} />
        <Field label="Delivery address">
          <select required value={customerAddressId} onChange={(event) => setCustomerAddressId(event.target.value)}>
            <option value="">Choose a saved address</option>
            {selectedCustomer?.addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.formattedAddress}</option>)}
          </select>
        </Field>
        <div className="grid content-start gap-2 text-sm text-[#4b4944]">
          <span className="font-bold">Prepared by</span>
          <p className="m-0 flex h-11 items-center font-semibold">{preparedByName}</p>
        </div>
        <Field label="Dispatch"><select required value={dispatchId} onChange={(event) => setDispatchId(event.target.value)}><option value="">Choose an active dispatch</option>{openDispatches.map((dispatch) => <option key={dispatch.id} value={dispatch.id}>{dispatch.referenceNumber} · {dispatch.van.name} · {dispatch.status.replaceAll("_", " ")}</option>)}</select></Field>
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-[var(--line)] pt-6">
        <h3 className="m-0 text-sm font-bold uppercase">Products</h3>
        <button className="secondary-button" type="button" onClick={addItem} disabled={!firstVariant || items.length >= Math.min(50, variants.length)}><Plus /> <span>Add product</span></button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div className="grid gap-3 border border-[var(--line)] p-4 sm:grid-cols-[minmax(0,1fr)_110px_140px_40px]" key={`${index}-${item.productVariantId}`}>
            <SearchCombobox id={`product-${index}`} label="Product" value={productQueries[index] || ""} options={searchVariants(variants, productQueries[index] || "", item.productVariantId).map((variant) => ({ id: variant.id, label: variantLabel(variant) }))} placeholder="Search product, category, or size" onChange={(value) => chooseVariant(index, value)} onSelect={(option) => selectVariant(index, option)} />
            <Field label="Quantity"><input type="number" min={1} max={10000} required value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></Field>
            <Field label="Unit price"><input type="number" min="0.01" max={1000000} step="0.01" required value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} /></Field>
            <button className="mt-6 grid h-10 w-10 place-items-center border border-[var(--line)] text-[var(--red)]" type="button" title="Remove product" aria-label="Remove product" disabled={items.length === 1} onClick={() => removeItem(index)}><Minus /></button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-[var(--muted)]">Create an active product before making a Baguio order.</p>}
      </div>
      <Field label="Delivery notes" wide extraClass="mt-5"><textarea rows={3} maxLength={500} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></Field>
      {!clients.some((client) => client.isActive) && <p className="mt-5 text-sm font-bold text-[var(--red)]">Register a Baguio client before creating an order.</p>}
      {!openDispatches.length && <p className="mt-5 text-sm font-bold text-[var(--red)]">Create a dispatch before adding an order.</p>}
      {openDispatches.some((dispatch) => dispatch.status === "in_transit") && <p className="mt-5 text-xs text-[var(--muted)]">Orders added to an in-transit dispatch are tagged as added during transit and appear only in the current/post-delivery allocation.</p>}
      {selectedCustomer && !selectedCustomer.addresses.length && <p className="mt-5 text-sm font-bold text-[var(--red)]">Add a saved address for this customer from the Customers screen.</p>}
      <div className="mt-7 flex justify-end"><button className="primary-button compact-button" type="submit" disabled={submitting || !items.length || items.some((item) => !item.productVariantId) || !dispatchId || !customerId || !customerAddressId}>{submitting ? "Creating…" : "Create order and documents"}</button></div>
    </form>
  );
}

function customerLabel(client: BaguioClient): string { return `${client.name} · ${client.referenceNumber}`; }
function defaultAddressId(client: BaguioClient | undefined): string { return client?.addresses.find((address) => address.isDefault)?.id || client?.addresses[0]?.id || ""; }
function variantLabel(variant: { productTitle: string; label: string }): string { return `${variant.productTitle} · ${variant.label}`; }

function Field({ label, wide = false, extraClass = "", children }: { label: string; wide?: boolean; extraClass?: string; children: React.ReactNode }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""} ${extraClass}`}>{label}<span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded [&>input]:border [&>input]:border-[#cbc7bd] [&>input]:px-3 [&>select]:h-11 [&>select]:w-full [&>select]:rounded [&>select]:border [&>select]:border-[#cbc7bd] [&>select]:bg-white [&>select]:px-3 [&>textarea]:w-full [&>textarea]:rounded [&>textarea]:border [&>textarea]:border-[#cbc7bd] [&>textarea]:p-3">{children}</span></label>;
}
