import { type FormEvent, useEffect, useRef, useState } from "react";
import { Plus, Tags, X } from "lucide-react";
import { createProduct, updateProduct, uploadProductImage } from "../services/products";
import type { Product, ProductInput } from "../types/product";

interface DraftVariant {
  label: string;
  price: string;
  image: string;
  imageFile: File | null;
  previewUrl: string;
}

interface ProductDraft extends Omit<ProductInput, "ingredients" | "allergens" | "variants"> {
  ingredientsText: string;
  allergensText: string;
  variants: DraftVariant[];
}

interface ProductFormProps {
  csrfToken: string;
  product?: Product;
  onCancel: () => void;
  onSaved: (product: Product) => void;
}

function createDraft(product?: Product): ProductDraft {
  return product ? {
    slug: product.slug,
    title: product.title,
    category: product.category,
    bestSeller: product.bestSeller,
    ingredientsText: product.ingredients.join("\n"),
    allergensText: product.allergens.join("\n"),
    short: product.short,
    variants: product.variants.map((variant) => ({ label: variant.label, price: String(variant.price), image: variant.image, imageFile: null, previewUrl: "" })),
  } : {
    slug: "",
    title: "",
    category: "",
    bestSeller: false,
    ingredientsText: "",
    allergensText: "",
    short: "",
    variants: [{ label: "", price: "", image: "", imageFile: null, previewUrl: "" }],
  };
}

const slugify = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toList = (value: string): string[] => value.split("\n").map((item) => item.trim()).filter(Boolean);

export function ProductForm({ csrfToken, product, onCancel, onSaved }: ProductFormProps) {
  const [draft, setDraft] = useState(() => createDraft(product));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function updateField<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateTitle(title: string) {
    setDraft((current) => ({ ...current, title, slug: current.slug === slugify(current.title) ? slugify(title) : current.slug }));
  }

  function updateVariant(index: number, field: "label" | "price", value: string) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, [field]: value } : variant),
    }));
  }

  function updateVariantImage(index: number, imageFile: File | null) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;
        if (variant.previewUrl) {
          URL.revokeObjectURL(variant.previewUrl);
          previewUrls.current.delete(variant.previewUrl);
        }
        const previewUrl = imageFile ? URL.createObjectURL(imageFile) : "";
        if (previewUrl) previewUrls.current.add(previewUrl);
        return { ...variant, imageFile, previewUrl };
      }),
    }));
  }

  function removeVariant(index: number) {
    const variant = draft.variants[index];
    if (variant?.previewUrl) {
      URL.revokeObjectURL(variant.previewUrl);
      previewUrls.current.delete(variant.previewUrl);
    }
    updateField("variants", draft.variants.filter((_, variantIndex) => variantIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (draft.variants.some((variant) => !variant.image && !variant.imageFile)) throw new Error("Choose an image for every size.");
      const files = draft.variants.flatMap((variant) => variant.imageFile ? [variant.imageFile] : []);
      if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) throw new Error("Product images must be JPEG, PNG, or WebP files.");
      if (files.some((file) => file.size > 5 * 1024 * 1024)) throw new Error("Product images must be 5 MB or smaller.");
      const variants = await Promise.all(draft.variants.map(async (variant) => ({
        label: variant.label,
        price: Number(variant.price),
        image: variant.imageFile ? await uploadProductImage(variant.imageFile, csrfToken) : variant.image,
      })));
      const input: ProductInput = {
        slug: draft.slug,
        title: draft.title,
        category: draft.category,
        bestSeller: draft.bestSeller,
        ingredients: toList(draft.ingredientsText),
        allergens: toList(draft.allergensText),
        short: draft.short,
        variants,
      };
      onSaved(product ? await updateProduct(product.id, input, csrfToken) : await createProduct(input, csrfToken));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to save the product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-heading"><div><p className="eyebrow">{product ? "Edit product" : "New product"}</p><h2>Product details</h2></div><Tags /></div>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="form-grid">
        <label>Product title<input value={draft.title} onChange={(event) => updateTitle(event.target.value)} required maxLength={120} /></label>
        <label>Slug<input value={draft.slug} onChange={(event) => updateField("slug", slugify(event.target.value))} required maxLength={80} /></label>
        <label>Category<input value={draft.category} onChange={(event) => updateField("category", event.target.value)} required maxLength={80} /></label>
        <label className="full-field">Short description<textarea value={draft.short} onChange={(event) => updateField("short", event.target.value)} required maxLength={800} rows={3} /></label>
        <label>Ingredients <small>One per line</small><textarea value={draft.ingredientsText} onChange={(event) => updateField("ingredientsText", event.target.value)} rows={5} /></label>
        <label>Allergens <small>One per line</small><textarea value={draft.allergensText} onChange={(event) => updateField("allergensText", event.target.value)} rows={5} /></label>
      </div>
      <label className="check-field"><input type="checkbox" checked={draft.bestSeller} onChange={(event) => updateField("bestSeller", event.target.checked)} /> Feature as a bestseller</label>
      <div className="sizes-heading"><div><strong>Sizes, prices, and images</strong><small>Every product needs at least one size and image</small></div><button className="secondary-button" type="button" onClick={() => updateField("variants", [...draft.variants, { label: "", price: "", image: "", imageFile: null, previewUrl: "" }])}><Plus /> Add size</button></div>
      {draft.variants.map((variant, index) => (
        <div className="size-row" key={index}>
          <label>Size<input value={variant.label} onChange={(event) => updateVariant(index, "label", event.target.value)} required maxLength={80} /></label>
          <label>Price (PHP)<input type="number" min="0.01" max="9999999.99" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} required /></label>
          <label>Product image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => updateVariantImage(index, event.target.files?.[0] || null)} required={!variant.image} />{(variant.previewUrl || variant.image) && <img className="image-preview" src={variant.previewUrl || variant.image} alt="Product preview" />}</label>
          {draft.variants.length > 1 && <button className="icon-remove" type="button" aria-label={`Remove size ${index + 1}`} title="Remove size" onClick={() => removeVariant(index)}><X /></button>}
        </div>
      ))}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button submit-product" type="submit" disabled={submitting}><span>{submitting ? "Saving product..." : "Save product"}</span></button></div>
    </form>
  );
}
