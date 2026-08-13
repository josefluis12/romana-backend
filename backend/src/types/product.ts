export interface ProductVariantInput {
  label: string;
  price: number;
  image: string;
}

export interface ProductInput {
  slug: string;
  title: string;
  category: string;
  bestSeller: boolean;
  ingredients: string[];
  allergens: string[];
  short: string;
  variants: ProductVariantInput[];
}

export interface ProductVariant extends ProductVariantInput {
  id: string;
}

export interface Product extends Omit<ProductInput, "variants"> {
  id: string;
  isActive: boolean;
  variants: ProductVariant[];
  createdAt: string;
}
