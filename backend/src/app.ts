import cors from "cors";
import express, { type CookieOptions, type Request, type Response } from "express";
import { config } from "./config.js";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  createAttemptLimiter,
  createCsrfToken,
  parseCookies,
  safeEqual,
} from "./security.js";
import { createSupabaseAuth, type AuthService } from "./supabase-auth.js";
import { createSupabaseProductRepository, type ProductRepository } from "./repositories/products.js";
import { createSupabaseOrderRepository, type OrderRepository } from "./repositories/orders.js";
import { validateProductInput } from "./schemas/product.js";
import { createSupabaseProductImageStorage, detectImageType, type ProductImageStorage } from "./services/product-images.js";
import { createMayaCheckoutService, type MayaCheckoutService } from "./services/maya-checkout.js";
import { completeStorefrontCheckout, createStorefrontCheckout, StorefrontCheckoutError } from "./services/storefront-checkout.js";
import { handleMayaWebhook, MayaWebhookError } from "./services/maya-webhook.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { createSupabaseChannelSalesRepository, type ChannelSalesRepository } from "./repositories/channel-sales.js";
import { registerChannelSalesRoutes } from "./routes/channel-sales.js";
import { getAuthenticatedUserName } from "./authenticated-user.js";
import { registerDispatchDriverRoutes } from "./routes/dispatch-drivers.js";
import { createSupabaseSystemUserService, isDispatchDriver, type SystemUserService } from "./services/system-users.js";
import { registerSystemUserRoutes } from "./routes/system-users.js";
import { createSessionManager, type ResolvedSession } from "./session-manager.js";
import { isUuid } from "./schemas/channel-sales.js";
import { createGoogleDriverRoutingService, type DriverRoutingService } from "./services/driver-routing.js";
interface AppDependencies {
  auth?: AuthService;
  products?: ProductRepository;
  productImages?: ProductImageStorage;
  maya?: MayaCheckoutService;
  orders?: OrderRepository;
  channelSales?: ChannelSalesRepository;
  systemUsers?: SystemUserService;
  driverRouting?: DriverRoutingService;
}

export function createApp({
  auth = createSupabaseAuth({ url: config.supabaseUrl, key: config.supabaseKey }),
  products = createSupabaseProductRepository(config.supabaseUrl, config.supabaseKey),
  productImages = createSupabaseProductImageStorage(config.supabaseUrl, config.supabaseKey),
  maya = createMayaCheckoutService(config.mayaApiUrl, config.mayaPublicKey, config.storefrontOrigin),
  orders = createSupabaseOrderRepository(config.supabaseUrl, config.supabaseSecretKey),
  channelSales = createSupabaseChannelSalesRepository(config.supabaseUrl, config.supabaseSecretKey),
  systemUsers = createSupabaseSystemUserService(config.supabaseUrl, config.supabaseSecretKey),
  driverRouting = createGoogleDriverRoutingService(config.googleMapsApiKey),
}: AppDependencies = {}) {
  const app = express();
  const limiter = createAttemptLimiter();
  const checkoutLimiter = createAttemptLimiter({ limit: 10, windowMs: 60_000 });

  app.disable("x-powered-by");
  app.use(cors({ origin: [config.frontendOrigin, config.storefrontOrigin, config.driverOrigin], credentials: true }));
  app.use(express.json({ limit: "10kb" }));
  app.use((_request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    next();
  });

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProduction,
    path: "/api",
  };

  const sessionManager = createSessionManager(auth, cookieOptions);
  const resolvedSessions = new WeakMap<Request, Promise<ResolvedSession>>();
  function resolveSession(request: Request, response: Response): Promise<ResolvedSession> {
    const existing = resolvedSessions.get(request);
    if (existing) return existing;
    const session = sessionManager.resolve(request, response);
    resolvedSessions.set(request, session);
    return session;
  }

  app.get("/api/health", (_request, response) => response.json({
    status: "ok",
    auth: auth.isConfigured ? "configured" : "setup_required",
  }));

  app.get("/api/auth/session", async (request, response) => {
    const { user, cookies } = await resolveSession(request, response);
    if (!user) {
      sessionManager.clear(response);
      return response.status(401).json({ authenticated: false });
    }
    const csrfToken = cookies[CSRF_COOKIE] || createCsrfToken();
    if (!cookies[CSRF_COOKIE]) {
      response.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    return response.json({ authenticated: true, user: { email: user.email, name: getAuthenticatedUserName(user) }, csrfToken });
  });

  app.post("/api/auth/login", async (request, response) => {
    const email = String(request.body.email || "").slice(0, 254).trim().toLowerCase();
    const password = String(request.body.password || "").slice(0, 512);
    const attemptKey = `${request.ip}:${email}`;

    if (!auth.isConfigured) {
      return response.status(503).json({ error: "Shop authentication is being configured." });
    }
    if (limiter.isLimited(attemptKey)) {
      return response.status(429).json({ error: "Too many sign-in attempts. Please try again in 15 minutes." });
    }

    const result = await auth.signIn(email, password);
    if (result.error || !result.session || !result.user) {
      limiter.recordFailure(attemptKey);
      return response.status(401).json({ error: "That email and password combination was not recognized." });
    }
    if (isDispatchDriver(result.user)) {
      await auth.signOut(result.session.access_token, result.session.refresh_token);
      return response.status(403).json({ error: "Use the driver app to sign in." });
    }

    limiter.clear(attemptKey);
    const csrfToken = createCsrfToken();
    sessionManager.set(response, result.session);
    response.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    return response.json({ user: { email: result.user.email, name: getAuthenticatedUserName(result.user) }, csrfToken });
  });

  app.post("/api/auth/logout", async (request, response) => {
    const cookies = parseCookies(request.headers.cookie);
    if (!safeEqual(request.body.csrfToken, cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    await auth.signOut(cookies[ACCESS_COOKIE], cookies[REFRESH_COOKIE]);
    sessionManager.clear(response);
    return response.status(204).send();
  });

  app.use("/api", async (request, response, next) => {
    if (request.path.startsWith("/driver/") || request.path.startsWith("/storefront/") || request.path.startsWith("/webhooks/")) return next();
    const session = await resolveSession(request, response);
    if (session.user && isDispatchDriver(session.user)) return response.status(403).json({ error: "Administrator access required." });
    return next();
  });

  app.get("/api/products", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user || !session.accessToken) return response.status(401).json({ error: "Authentication required." });
    try {
      return response.json({ products: await products.list(session.accessToken) });
    } catch {
      return response.status(503).json({ error: "The product catalog is unavailable." });
    }
  });

  app.get("/api/storefront/products", async (_request, response) => {
    try {
      const catalog = (await products.listPublic()).filter((product) => product.isActive).map((product) => ({
        slug: product.slug,
        title: product.title,
        category: product.category,
        bestSeller: product.bestSeller,
        ingredients: product.ingredients,
        allergens: product.allergens,
        short: product.short,
        variants: product.variants.map(({ label, price, image }) => ({ label, price, image })),
      }));
      return response.json({ products: catalog });
    } catch {
      return response.status(503).json({ error: "The storefront catalog is unavailable." });
    }
  });

  registerOrderRoutes(app, orders, maya, resolveSession);
  registerChannelSalesRoutes(app, channelSales, resolveSession);
  registerDispatchDriverRoutes(app, systemUsers, channelSales, driverRouting, resolveSession);
  registerSystemUserRoutes(app, systemUsers, resolveSession);

  app.post("/api/storefront/checkouts", async (request, response) => {
    const attemptKey = request.ip || "unknown";
    if (checkoutLimiter.isLimited(attemptKey)) {
      return response.status(429).json({ error: "Too many checkout attempts. Please try again shortly." });
    }
    checkoutLimiter.recordFailure(attemptKey);
    try {
      const checkout = await createStorefrontCheckout(request.body, products, maya, orders);
      return response.status(201).json(checkout);
    } catch (error) {
      if (error instanceof StorefrontCheckoutError) return response.status(400).json({ error: error.message });
      return response.status(503).json({ error: "Maya Checkout is temporarily unavailable." });
    }
  });

  app.post("/api/storefront/checkouts/:checkoutId/complete", async (request, response) => {
    try {
      const result = await completeStorefrontCheckout(request.params.checkoutId || "", maya, orders);
      return response.json(result);
    } catch (error) {
      if (error instanceof StorefrontCheckoutError) return response.status(400).json({ error: error.message });
      return response.status(503).json({ error: "Payment confirmation is temporarily unavailable." });
    }
  });

  app.post("/api/webhooks/maya", async (request, response) => {
    try {
      const result = await handleMayaWebhook(request.body, maya, orders);
      return response.json(result);
    } catch (error) {
      if (error instanceof MayaWebhookError) return response.status(400).json({ error: error.message });
      return response.status(503).json({ error: "The payment notification could not be processed." });
    }
  });

  app.post("/api/product-images", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user || !session.accessToken) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return response.status(400).json({ error: "Choose a JPEG, PNG, or WebP image." });
    }
    const contentType = detectImageType(request.body);
    if (!contentType || contentType !== request.header("content-type")?.toLowerCase()) {
      return response.status(400).json({ error: "The uploaded file is not a valid JPEG, PNG, or WebP image." });
    }
    try {
      const url = await productImages.upload(session.accessToken, session.user.id, request.body, contentType);
      return response.status(201).json({ url });
    } catch {
      return response.status(503).json({ error: "The product image could not be uploaded." });
    }
  });

  app.post("/api/products", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user || !session.accessToken) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    const validation = validateProductInput(request.body);
    if (!validation.product) return response.status(400).json({ error: validation.error });
    try {
      const product = await products.create(session.accessToken, validation.product);
      return response.status(201).json({ product });
    } catch {
      return response.status(503).json({ error: "The product could not be saved." });
    }
  });

  app.put("/api/products/:productId", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user || !session.accessToken) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    const productId = request.params.productId;
    if (!productId || !isUuid(productId)) return response.status(400).json({ error: "Invalid product identifier." });
    const validation = validateProductInput(request.body);
    if (!validation.product) return response.status(400).json({ error: validation.error });
    try {
      return response.json({ product: await products.update(session.accessToken, productId, validation.product) });
    } catch {
      return response.status(503).json({ error: "The product could not be updated." });
    }
  });

  app.patch("/api/products/:productId/status", async (request, response) => {
    const session = await resolveSession(request, response);
    if (!session.user || !session.accessToken) return response.status(401).json({ error: "Authentication required." });
    if (!safeEqual(request.header("x-csrf-token"), session.cookies[CSRF_COOKIE])) {
      return response.status(403).json({ error: "Forbidden" });
    }
    const productId = request.params.productId;
    if (!productId || !isUuid(productId)) return response.status(400).json({ error: "Invalid product identifier." });
    if (typeof request.body.isActive !== "boolean") return response.status(400).json({ error: "Product status is required." });
    try {
      return response.json({ product: await products.setActive(session.accessToken, productId, request.body.isActive) });
    } catch {
      return response.status(503).json({ error: "The product status could not be updated." });
    }
  });

  app.use("/api", (_request, response) => response.status(404).json({ error: "Not found" }));
  app.use((error: unknown, _request: Request, response: Response, next: (error?: unknown) => void) => {
    if (isPayloadTooLarge(error)) return response.status(413).json({ error: "Product images must be 5 MB or smaller." });
    return next(error);
  });
  return app;
}

function isPayloadTooLarge(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 413;
}
