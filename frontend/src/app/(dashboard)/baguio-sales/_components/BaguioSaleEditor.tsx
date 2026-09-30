import { Minus, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { BaguioSale, BaguioSaleUpdateInput } from "../../../../types/channel-sale";
import type { Product } from "../../../../types/product";

type ItemDraft = BaguioSaleUpdateInput["items"][number];

export function BaguioSaleEditor({ sale, products, submitting, onClose, onSubmit }: {
  sale: BaguioSale; products: Product[]; submitting: boolean; onClose: () => void;
  onSubmit: (input: BaguioSaleUpdateInput) => Promise<boolean>;
}) {
  const variants = products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productTitle: product.title, productActive: product.isActive })))
    .sort((a, b) => `${a.productTitle} ${a.label}`.localeCompare(`${b.productTitle} ${b.label}`));
  const [items, setItems] = useState<ItemDraft[]>(sale.items.map(({ productVariantId, quantity, unitPrice }) => ({ productVariantId, quantity, unitPrice })));
  const [deliveryNotes, setDeliveryNotes] = useState(sale.deliveryNotes);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSubmit({ items, deliveryNotes })) onClose();
  }
  function selectVariant(index: number, id: string) {
    const variant = variants.find((candidate) => candidate.id === id);
    if (variant) setItems((current) => current.map((item, i) => i === index ? { ...item, productVariantId: id, unitPrice: variant.price } : item));
  }
  function update(index: number, value: Partial<ItemDraft>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...value } : item));
  }
  function addItem() {
    const available = variants.find((variant) => !items.some((item) => item.productVariantId === variant.id));
    if (available) setItems((current) => [...current, { productVariantId: available.id, quantity: 1, unitPrice: available.price }]);
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4" role="presentation">
      <form className="w-full max-w-3xl border border-[var(--line)] bg-white p-5 shadow-2xl sm:p-7" onSubmit={(event) => void submit(event)}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4"><div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">{sale.referenceNumber}</p><h2 className="mb-0 mt-1 font-serif text-2xl">Reallocate order inventory</h2></div><button className="grid size-9 place-items-center border border-[var(--line)] bg-white" type="button" onClick={onClose} aria-label="Close editor" title="Close"><X /></button></header>
        <p className="text-sm text-[var(--muted)]">Changes update this order’s total and its factory-to-van allocation, including while the dispatch is in transit.</p>
        <div className="grid max-h-[45vh] gap-3 overflow-y-auto">
          {items.map((item, index) => <div className="grid gap-3 border border-[var(--line)] p-4 sm:grid-cols-[minmax(0,1fr)_100px_130px_40px]" key={`${index}-${item.productVariantId}`}>
            <Field label="Product"><select value={item.productVariantId} onChange={(event) => selectVariant(index, event.target.value)}>{variants.map((variant) => <option disabled={!variant.productActive && item.productVariantId !== variant.id || items.some((candidate, i) => i !== index && candidate.productVariantId === variant.id)} value={variant.id} key={variant.id}>{variant.productTitle} · {variant.label}</option>)}</select></Field>
            <Field label="Quantity"><input required type="number" min={1} max={10000} value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} /></Field>
            <Field label="Unit price"><input required type="number" min="0.01" max={1000000} step="0.01" value={item.unitPrice} onChange={(event) => update(index, { unitPrice: Number(event.target.value) })} /></Field>
            <button className="mt-6 grid size-10 place-items-center border border-[var(--line)] text-[var(--red)]" type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label="Remove product"><Minus /></button>
          </div>)}
        </div>
        <button className="secondary-button mt-4" type="button" onClick={addItem} disabled={items.length >= variants.length}><Plus />Add product</button>
        <label className="mt-5 grid gap-2 text-sm font-bold">Delivery notes<textarea className="rounded border border-[#cbc7bd] p-3" rows={3} maxLength={500} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></label>
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button compact-button" disabled={submitting || !items.length}>{submitting ? "Saving…" : "Save and reallocate"}</button></div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold"><span>{label}</span><span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded [&>input]:border [&>input]:border-[#cbc7bd] [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded [&>select]:border [&>select]:border-[#cbc7bd] [&>select]:bg-white [&>select]:px-3">{children}</span></label>;
}
