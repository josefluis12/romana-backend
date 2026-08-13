import type { OrderRepository } from "../repositories/orders.js";
import type { MayaCheckoutService } from "./maya-checkout.js";

export class MayaWebhookError extends Error {}

function readPaymentEvent(value: unknown): { paymentId: string; paymentStatus: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new MayaWebhookError("Invalid payment event.");
  const paymentId = Reflect.get(value, "id");
  const paymentStatus = Reflect.get(value, "paymentStatus");
  if (typeof paymentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(paymentId)) {
    throw new MayaWebhookError("Invalid payment event.");
  }
  if (typeof paymentStatus !== "string") throw new MayaWebhookError("Invalid payment event.");
  return { paymentId, paymentStatus };
}

export async function handleMayaWebhook(value: unknown, maya: MayaCheckoutService, orders: OrderRepository) {
  const event = readPaymentEvent(value);
  if (event.paymentStatus !== "PAYMENT_SUCCESS") return { accepted: true, orderId: null };
  const verifiedStatus = await maya.getPaymentStatus(event.paymentId);
  if (verifiedStatus !== "PAYMENT_SUCCESS") throw new MayaWebhookError("Payment status could not be verified.");
  const completed = await orders.completePaidCheckout(event.paymentId);
  return { accepted: true, orderId: completed?.orderId ?? null };
}
