import { useEffect, useMemo, useState } from "react";
import { Ban, Eye, PackageOpen, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { listProducts, setProductActive } from "../services/products";
import type { Product } from "../types/product";
import { ProductForm } from "./ProductForm";

interface ProductCatalogProps {
  csrfToken: string;
}

export function ProductCatalog({ csrfToken }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [bestSeller, setBestSeller] = useState("all");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [changingStatus, setChangingStatus] = useState("");

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);
  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !search || [product.title, product.slug, product.category].some((value) => value.toLowerCase().includes(search));
      return matchesQuery
        && (category === "all" || product.category === category)
        && (bestSeller === "all" || product.bestSeller === (bestSeller === "yes"))
        && (status === "all" || product.isActive === (status === "active"));
    });
  }, [bestSeller, category, products, query, status]);

  useEffect(() => {
    let active = true;
    listProducts()
      .then((items) => { if (active) setProducts(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load products."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function saveProduct(product: Product) {
    setProducts((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? product : item)
      : [product, ...current]);
    setEditing(null);
    setShowCreate(false);
  }

  async function changeStatus(product: Product) {
    if (product.isActive && !window.confirm(`Disable ${product.title}?`)) return;
    setChangingStatus(product.id);
    setError("");
    try {
      const updated = await setProductActive(product.id, !product.isActive, csrfToken);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to change the product status.");
    } finally {
      setChangingStatus("");
    }
  }

  const formOpen = showCreate || Boolean(editing);
  return (
    <section className="catalog-section" aria-label="Product catalog">
      <div className="catalog-toolbar">
        <p>{products.length} {products.length === 1 ? "product" : "products"}</p>
        {!formOpen && <button className="primary-button compact-button" type="button" onClick={() => setShowCreate(true)}><Plus /><span>Add product</span></button>}
      </div>
      {error && <div className="alert" role="alert">{error}</div>}

      {formOpen ? (
        <ProductForm csrfToken={csrfToken} product={editing || undefined} onSaved={saveProduct} onCancel={() => { setEditing(null); setShowCreate(false); }} />
      ) : (
        <>
          {!loading && products.length > 0 && <CatalogFilters query={query} category={category} bestSeller={bestSeller} status={status} categories={categories} onQuery={setQuery} onCategory={setCategory} onBestSeller={setBestSeller} onStatus={setStatus} />}
          {loading && <div className="catalog-status" role="status">Loading products...</div>}
          {!loading && products.length === 0 && <div className="empty-state product-empty-state"><PackageOpen /><h2>Your product catalog is empty</h2><p>Add your first product to begin managing the catalog.</p></div>}
          {products.length > 0 && <ProductTable products={filteredProducts} total={products.length} changingStatus={changingStatus} onView={setViewing} onEdit={setEditing} onChangeStatus={changeStatus} />}
        </>
      )}
      {viewing && <ProductDetails product={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

interface FilterProps {
  query: string; category: string; bestSeller: string; status: string; categories: string[];
  onQuery: (value: string) => void; onCategory: (value: string) => void;
  onBestSeller: (value: string) => void; onStatus: (value: string) => void;
}

function CatalogFilters(props: FilterProps) {
  return <div className="catalog-filters" aria-label="Product filters">
    <label className="search-field"><span>Search</span><div><Search /><input type="search" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Name, slug, or category" /></div></label>
    <label><span>Category</span><select value={props.category} onChange={(event) => props.onCategory(event.target.value)}><option value="all">All</option>{props.categories.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Bestseller</span><select value={props.bestSeller} onChange={(event) => props.onBestSeller(event.target.value)}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
    <label><span>Status</span><select value={props.status} onChange={(event) => props.onStatus(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
  </div>;
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

interface TableProps {
  products: Product[]; total: number; changingStatus: string;
  onView: (product: Product) => void; onEdit: (product: Product) => void; onChangeStatus: (product: Product) => void;
}

function ProductTable({ products, total, changingStatus, onView, onEdit, onChangeStatus }: TableProps) {
  if (products.length === 0) return <p className="no-results">No products match the current filters.</p>;
  return <div className="catalog-table-wrap">
    <p className="table-count">Showing {products.length} of {total}</p>
    <table className="catalog-table">
      <thead><tr><th>Product</th><th>Category</th><th>Sizes and prices</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{products.map((product) => <tr key={product.id} className={product.isActive ? undefined : "disabled-row"}>
        <td><div className="product-cell"><img src={product.variants[0]?.image} alt="" /><div><strong>{product.title}</strong><small>{product.slug}</small></div></div></td>
        <td>{product.category}</td>
        <td>{product.variants.map((variant) => `${variant.label}: ${peso.format(variant.price)}`).join(", ")}</td>
        <td>{product.isActive ? "Active" : "Disabled"}</td>
        <td><div className="table-actions">
          <button type="button" onClick={() => onView(product)}><Eye /> View</button>
          <button type="button" onClick={() => onEdit(product)}><Pencil /> Edit</button>
          <button type="button" disabled={changingStatus === product.id} onClick={() => onChangeStatus(product)}>{product.isActive ? <Ban /> : <RotateCcw />}{product.isActive ? "Disable" : "Enable"}</button>
        </div></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function ProductDetails({ product, onClose }: { product: Product; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
      <header><div><small>{product.category}</small><h2 id="product-dialog-title">{product.title}</h2></div><button type="button" onClick={onClose} aria-label="Close product details" title="Close"><X /></button></header>
      <p>{product.short}</p>
      <dl><div><dt>Status</dt><dd>{product.isActive ? "Active" : "Disabled"}</dd></div><div><dt>Bestseller</dt><dd>{product.bestSeller ? "Yes" : "No"}</dd></div><div><dt>Slug</dt><dd>{product.slug}</dd></div></dl>
      <h3>Sizes</h3><div className="detail-variants">{product.variants.map((variant) => <article key={variant.id}><img src={variant.image} alt="" /><div><strong>{variant.label}</strong><span>{peso.format(variant.price)}</span></div></article>)}</div>
      <h3>Ingredients</h3><p>{product.ingredients.join(", ") || "None listed"}</p>
      <h3>Allergens</h3><p>{product.allergens.join(", ") || "None listed"}</p>
    </section>
  </div>;
}
