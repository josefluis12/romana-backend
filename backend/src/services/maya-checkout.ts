export interface MayaLineItem {
  name: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface MayaCheckoutService {
  isConfigured: boolean;
  create(items: MayaLineItem[], requestReferenceNumber: string): Promise<{ checkoutId: string; redirectUrl: string }>;
  getPaymentStatus(paymentId: string): Promise<string>;
}

function readCheckoutResponse(value: unknown): { checkoutId: string; redirectUrl: string } {
  if (typeof value !== "object" || value === null) throw new Error("Maya returned an invalid response.");
  const checkoutId = Reflect.get(value, "checkoutId");
  const redirectUrl = Reflect.get(value, "redirectUrl");
  if (typeof checkoutId !== "string" || typeof redirectUrl !== "string") throw new Error("Maya returned an invalid response.");
  const parsedUrl = new URL(redirectUrl);
  const allowedHosts = new Set([
    "payments-web-sandbox.maya.ph",
    "payments-web-sandbox.paymaya.com",
    "payments.maya.ph",
    "payments.paymaya.com",
  ]);
  if (parsedUrl.protocol !== "https:" || !allowedHosts.has(parsedUrl.hostname)) throw new Error("Maya returned an invalid redirect URL.");
  return { checkoutId, redirectUrl };
}

export function createMayaCheckoutService(apiUrl: string, publicKey: string, storefrontOrigin: string): MayaCheckoutService {
  const authorization = `Basic ${Buffer.from(`${publicKey}:`).toString("base64")}`;
  return {
    isConfigured: Boolean(publicKey),
    async create(items, requestReferenceNumber) {
      if (!publicKey) throw new Error("Maya Checkout is not configured.");
      const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const response = await fetch(`${apiUrl}/checkout/v1/checkouts`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          totalAmount: { value: total, currency: "PHP" },
          items: items.map((item) => ({
            name: item.name,
            code: item.code,
            description: item.description,
            quantity: item.quantity,
            amount: { value: item.unitPrice },
            totalAmount: { value: item.unitPrice * item.quantity },
          })),
          redirectUrl: {
            success: `${storefrontOrigin}/payment?status=success`,
            failure: `${storefrontOrigin}/payment?status=failure`,
            cancel: `${storefrontOrigin}/payment?status=cancelled`,
          },
          requestReferenceNumber,
        }),
      });
      if (!response.ok) throw new Error("Maya Checkout request failed.");
      return readCheckoutResponse(await response.json());
    },
    async getPaymentStatus(paymentId) {
      if (!publicKey) throw new Error("Maya Checkout is not configured.");
      const response = await fetch(`${apiUrl}/payments/v1/payments/${encodeURIComponent(paymentId)}/status`, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", Authorization: authorization },
      });
      if (!response.ok) throw new Error("Maya payment status request failed.");
      const value: unknown = await response.json();
      if (typeof value !== "object" || value === null) throw new Error("Maya returned an invalid payment status.");
      const status = Reflect.get(value, "paymentStatus") ?? Reflect.get(value, "status");
      if (typeof status !== "string") throw new Error("Maya returned an invalid payment status.");
      return status;
    },
  };
}
