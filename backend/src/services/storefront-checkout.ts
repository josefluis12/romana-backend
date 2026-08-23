import { randomUUID } from "node:crypto";
import type { ProductRepository } from "../repositories/products.js";
import type { OrderRepository } from "../repositories/orders.js";
import { validateCheckoutDetails } from "../schemas/storefront-checkout.js";
import type { PendingOrderItem } from "../types/order.js";
import type { MayaCheckoutService, MayaLineItem } from "./maya-checkout.js";
export { StorefrontCheckoutError } from "./storefront-checkout-error.js";
import { StorefrontCheckoutError } from "./storefront-checkout-error.js";

interface CartItem {
  slug: string;
  size: string;
  quantity: number;
}

function validateCart(value: unknown): CartItem[] {
  if (typeof value !== "object" || value === null) throw new StorefrontCheckoutError("A cart is required.");
  const items = Reflect.get(value, "items");
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) throw new StorefrontCheckoutError("Add between 1 and 20 products.");
  return items.map((item) => {
    if (typeof item !== "object" || item === null) throw new StorefrontCheckoutError("The cart contains an invalid product.");
    const slug = Reflect.get(item, "slug");
    const size = Reflect.get(item, "size");
    const quantity = Reflect.get(item, "quantity");
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new StorefrontCheckoutError("The cart contains an invalid product.");
    if (typeof size !== "string" || size.length < 1 || size.length > 80) throw new StorefrontCheckoutError("Choose a valid product size.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new StorefrontCheckoutError("Product quantities must be between 1 and 20.");
    return { slug, size, quantity };
  });
}

export async function createStorefrontCheckout(
  rawCart: unknown,
  products: ProductRepository,
  maya: MayaCheckoutService,
  orders: OrderRepository,
) {
  if (!maya.isConfigured) throw new Error("Maya Checkout is not configured.");
  const cart = validateCart(rawCart);
  const details = validateCheckoutDetails(rawCart);
  const catalog = (await products.listPublic()).filter((product) => product.isActive);
  const orderItems: PendingOrderItem[] = [];
  const lineItems: MayaLineItem[] = cart.map((cartItem) => {
    const product = catalog.find((candidate) => candidate.slug === cartItem.slug);
    const variant = product?.variants.find((candidate) => candidate.label === cartItem.size);
    if (!product || !variant) throw new StorefrontCheckoutError("A cart product is unavailable or has changed.");
    orderItems.push({
      productSlug: product.slug,
      productTitle: product.title,
      variantLabel: variant.label,
      quantity: cartItem.quantity,
      unitPrice: variant.price,
    });
    return {
      name: product.title,
      code: `${product.slug}-${variant.label}`.slice(0, 50),
      description: variant.label,
      quantity: cartItem.quantity,
      unitPrice: variant.price,
    };
  });
  const requestReferenceNumber = randomUUID();
  const total = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  await orders.createPending({ ...details, requestReferenceNumber, items: orderItems, total });
  const checkout = await maya.create(lineItems, requestReferenceNumber);
  await orders.attachMayaCheckout(requestReferenceNumber, checkout.checkoutId);
  return checkout;
}

export async function completeStorefrontCheckout(
  checkoutId: string,
  maya: MayaCheckoutService,
  orders: OrderRepository,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(checkoutId)) {
    throw new StorefrontCheckoutError("Invalid checkout identifier.");
  }
  const paymentStatus = await maya.getPaymentStatus(checkoutId);
  if (paymentStatus !== "PAYMENT_SUCCESS") {
    throw new StorefrontCheckoutError("Payment has not been confirmed.");
  }
  const completed = await orders.completePaidCheckout(checkoutId);
  if (!completed) throw new StorefrontCheckoutError("Checkout session was not found.");
  return { orderId: completed.orderId, created: completed.created };
}
