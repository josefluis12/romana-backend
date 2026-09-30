import { useEffect, useState } from "react";
import { advanceBaguioDispatch, advanceBaguioSale, createBaguioDispatch, createBaguioSale, listBaguioClients, listBaguioDispatches, listBaguioSales, listDispatchDrivers, listVehicles, updateBaguioSale } from "../../../services/channel-sales";
import { listProducts } from "../../../services/products";
import type { BaguioClient, BaguioDispatch, BaguioDispatchAction, BaguioDispatchInput, BaguioSale, BaguioSaleAction, BaguioSaleInput, BaguioSaleUpdateInput, DispatchDriver, InventoryLocation } from "../../../types/channel-sale";
import type { Product } from "../../../types/product";
import { BaguioDispatchForm } from "./_components/BaguioDispatchForm";
import { BaguioDispatchDetails } from "./_components/BaguioDispatchDetails";
import { BaguioOrdersByDispatch } from "./_components/BaguioOrdersByDispatch";
import { BaguioSaleDetails } from "./_components/BaguioSaleDetails";
import { BaguioSaleForm } from "./_components/BaguioSaleForm";
import { getExpectedDispatchReference } from "./_lib/dispatch-reference";
import { readBaguioSalesSubview, readSelectedBaguioDispatchId, readSelectedBaguioSaleId } from "./_lib/routing";

export function BaguioSalesPage({ csrfToken, preparedByName }: { csrfToken: string; preparedByName: string }) {
  const [sales, setSales] = useState<BaguioSale[]>([]);
  const [dispatches, setDispatches] = useState<BaguioDispatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vehicles, setVehicles] = useState<InventoryLocation[]>([]);
  const [clients, setClients] = useState<BaguioClient[]>([]);
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [selectedId, setSelectedId] = useState(() => readSelectedBaguioSaleId(window.location.hash));
  const [selectedDispatchId, setSelectedDispatchId] = useState(() => readSelectedBaguioDispatchId(window.location.hash));
  const [subview, setSubview] = useState(() => readBaguioSalesSubview(window.location.hash));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [nextSales, nextDispatches, nextProducts, nextVehicles, nextClients, nextDrivers] = await Promise.all([listBaguioSales(), listBaguioDispatches(), listProducts(), listVehicles(), listBaguioClients(), listDispatchDrivers()]);
      setSales(nextSales); setDispatches(nextDispatches); setProducts(nextProducts); setVehicles(nextVehicles); setClients(nextClients); setDrivers(nextDrivers);
    } catch (cause) { setError(messageFor(cause)); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    function syncHash() { setSelectedId(readSelectedBaguioSaleId(window.location.hash)); setSelectedDispatchId(readSelectedBaguioDispatchId(window.location.hash)); setSubview(readBaguioSalesSubview(window.location.hash)); }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  async function createOrder(input: BaguioSaleInput) {
    setSubmitting(true); setError("");
    try { const id = await createBaguioSale(input, csrfToken); await refreshOrders(); window.location.hash = `baguio-sales/${id}`; }
    catch (cause) { setError(messageFor(cause)); } finally { setSubmitting(false); }
  }
  async function createDispatch(input: BaguioDispatchInput) {
    setSubmitting(true); setError("");
    try { const id = await createBaguioDispatch(input, csrfToken); setDispatches(await listBaguioDispatches()); window.location.hash = `baguio-sales/dispatches/${id}`; }
    catch (cause) { setError(messageFor(cause)); } finally { setSubmitting(false); }
  }
  async function advanceOrder(id: string, action: BaguioSaleAction) {
    setSubmitting(true); setError("");
    try { await advanceBaguioSale(id, action, csrfToken); await refreshOrders(); }
    catch (cause) { setError(messageFor(cause)); } finally { setSubmitting(false); }
  }
  async function updateOrder(id: string, input: BaguioSaleUpdateInput): Promise<boolean> {
    setSubmitting(true); setError("");
    try { await updateBaguioSale(id, input, csrfToken); await refreshOrders(); return true; }
    catch (cause) { setError(messageFor(cause)); return false; } finally { setSubmitting(false); }
  }
  async function advanceDispatch(id: string, action: BaguioDispatchAction) {
    setSubmitting(true); setError("");
    try { await advanceBaguioDispatch(id, action, csrfToken); const [nextSales, nextDispatches] = await Promise.all([listBaguioSales(), listBaguioDispatches()]); setSales(nextSales); setDispatches(nextDispatches); }
    catch (cause) { setError(messageFor(cause)); } finally { setSubmitting(false); }
  }
  async function refreshOrders() {
    const [nextSales, nextDispatches] = await Promise.all([listBaguioSales(), listBaguioDispatches()]);
    setSales(nextSales); setDispatches(nextDispatches);
  }

  if (loading) return <div className="catalog-status" role="status">Loading Baguio sales…</div>;
  const selected = sales.find((sale) => sale.id === selectedId);
  const selectedDispatch = dispatches.find((dispatch) => dispatch.id === selectedDispatchId);
  if (selected) return <><ErrorMessage value={error} /><BaguioSaleDetails sale={selected} products={products} updating={submitting} onAdvance={(action) => advanceOrder(selected.id, action)} onUpdate={(input) => updateOrder(selected.id, input)} /></>;
  if (selectedDispatch) return <><ErrorMessage value={error} /><BaguioDispatchDetails dispatch={selectedDispatch} updating={submitting} onAdvance={advanceDispatch} /></>;
  if (subview === "new-order") return <><ErrorMessage value={error} /><BaguioSaleForm products={products.filter((product) => product.isActive)} dispatches={dispatches} clients={clients} preparedByName={preparedByName} submitting={submitting} onCancel={returnToSales} onSubmit={createOrder} /></>;
  if (subview === "new-dispatch") return <><ErrorMessage value={error} /><BaguioDispatchForm expectedReference={getExpectedDispatchReference(dispatches)} vehicles={vehicles} drivers={drivers} submitting={submitting} onCancel={returnToSales} onSubmit={createDispatch} /></>;

  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <p className="m-0 text-sm text-[var(--muted)]">Factory-to-van dispatches, orders, documents, and delivery status</p>
        <label className="grid gap-1 text-xs font-bold min-[801px]:hidden">Quick action
          <select className="h-10 rounded border border-[var(--line)] bg-white px-3 text-sm" value="" onChange={(event) => { if (event.target.value) window.location.hash = event.target.value; }}>
            <option value="">Choose…</option>
            <option value="baguio-sales/new-order">New order</option>
            <option value="baguio-sales/new-dispatch">New dispatch</option>
          </select>
        </label>
      </div>
      <ErrorMessage value={error} />
      <BaguioOrdersByDispatch dispatches={dispatches} />
    </section>
  );
}

function returnToSales() { window.location.hash = "baguio-sales"; }

function ErrorMessage({ value }: { value: string }) { return value ? <div className="alert" role="alert">{value}</div> : null; }
function messageFor(cause: unknown): string { return cause instanceof Error ? cause.message : "The Baguio sales workspace is unavailable."; }
