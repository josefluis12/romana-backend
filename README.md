# Romana Operations Admin

The private administration system and API foundation for Romana's sales channels
and future ERP workflows. The online shop is one sales channel. The workspace also
includes a separate Expo application for dispatch drivers.

## Architecture

```text
backend/
  src/           Express API, authentication, and business logic
  test/          Backend tests
  supabase/      Supabase config, migrations, and seed data
  .env           Backend-only environment values (ignored)
  package.json   Backend dependencies and commands
frontend/
  src/           React admin interface
  public/        Browser assets
  package.json   Frontend dependencies and commands
driver/
  src/           Expo Router screens, mobile features, services, and types
  assets/        Mobile app icons and splash assets
  package.json   Expo and React Native dependencies and commands
```

The frontend calls relative `/api/*` endpoints. Vite proxies those requests to the
backend during development. Supabase access, administrator authorization, session
cookies, validation, data access, and all shop business rules belong in `backend/`.
The frontend does not import backend modules or receive Supabase credentials.

## Supabase

Copy the backend environment template and add the hosted project values:

```bash
cp backend/.env.example backend/.env
```

Required backend variables:

- `SUPABASE_URL`: the project URL
- `SUPABASE_PUBLISHABLE_KEY`: the publishable key; a legacy anon key is also accepted
- `SUPABASE_SECRET_KEY`: a backend-only secret key used to persist paid orders and customers
- `FRONTEND_ORIGIN`: the permitted admin frontend origin
- `STOREFRONT_ORIGIN`: the permitted public storefront origin
- `DRIVER_ORIGIN`: the permitted Expo web origin
- `MAYA_API_URL`: Maya Checkout API origin; use `https://pg-sandbox.paymaya.com` for sandbox
- `MAYA_PUBLIC_KEY`: the Maya Checkout public key used only by the backend; local sandbox development falls back to Maya's published shared test key
- `GOOGLE_MAPS_API_KEY`: a backend-only key with Places API (New), Routes API, and Maps Static API enabled for customer address search and driver routing

Register `https://your-backend.example/api/webhooks/maya` for Maya's
`PAYMENT_SUCCESS` event. The backend verifies the reported payment with Maya before
creating an order. Webhook retries are idempotent, and customer email addresses are
normalized so each unique email maps to one customer record. Never expose the
Supabase secret key to either frontend.

Verified payments appear under **Orders** in the admin portal. Administrators can
review the customer, delivery address, line items, paid total, and advance fulfilment
through paid, processing, shipped, and completed states.

## Baguio Sales

The **Baguio Sales** workspace models the factory-to-van delivery process separately
from online checkout. A dispatch must be created for a van before customer orders can
be added to it. One dispatch can contain multiple orders, and creating each order also
creates a numbered Delivery Order Form and a pending Delivery Receipt. The workflow is:

```text
Order created → Pending approval → Approved → Loaded → In transit → Delivered → Successful
```

Loading records the product transfer from the factory to the dispatch's van inventory
location. A dispatch can start only after all its orders are loaded; starting it moves
every attached order to **In transit** atomically. In the driver app, each in-transit
order appears as a pending delivery. Marking it delivered requires the client's
signature and foreground location; the API saves the signature, coordinates, accuracy,
driver identity, and server timestamp atomically with the **Delivered** transition.
The Delivery Receipt stays pending until the delivered order is confirmed successful.
The DOF, DR, and per-order summary are printable.

Order product lines, quantities, prices, and delivery notes can be revised until the
order is delivered, including while its dispatch is in transit. For loaded orders,
the same transaction updates the factory-to-van transfer allocation and records a
before/after revision for audit purposes.

Each dispatch has a shareable detail URL with its own Preparing → In transit →
Completed tracker. Starting a dispatch freezes a pre-dispatch allocation snapshot.
The report presents products as rows and customer orders as columns, then compares
that snapshot with the current or post-delivery allocation. Orders revised after
creation and customers added during transit are tagged for reconciliation.

Every new dispatch requires one driver account. Administrators create restricted
driver accounts in the Baguio sales workspace and assign a driver while preparing
the dispatch. Driver accounts carry the protected `dispatch_driver` role in Supabase
Auth app metadata and cannot use admin APIs. The driver application accepts only
restricted driver accounts and retrieves assignments associated with the signed-in account
from `GET /api/driver/dispatches` with a bearer access token. This endpoint should be
called through the Supabase mobile SDK by sending its access token to the backend as
`Authorization: Bearer <token>`.

Customers are registered in the shared **Customers** workspace and associated with
one or more sales channels. The Baguio customer tab supplies the directory used by
Baguio orders; online checkout customers live in the same master table. Orders
reference the shared customer record and retain a name, address, and phone snapshot
so previously issued documents remain accurate after future directory changes.
New Baguio orders require a Philippine location selected through Google Places. The
backend keeps the Google key private and stores the formatted address, Place ID, and
coordinates with the order so route planning does not need to reinterpret the address.

The initial migration creates `Baguio Van 1`; add each real van as a separate active
`inventory_locations` record with type `vehicle` before operational use.

Create administrators as email/password users in Supabase Authentication. Accounts
without the restricted `dispatch_driver` app-metadata role can access the admin
portal; driver accounts must use the driver application API.
Never put a secret or service-role key in the frontend or commit it to this repository.

Supabase CLI state is scoped to `backend/supabase`. Run Supabase commands from the
`backend` directory so future migrations remain part of the backend application.

Apply the checked-in migrations before using catalog or order management:

```bash
cd backend
npx supabase db push
```

Products are stored separately from their size variants. Each required variant owns
its size label, numeric PHP price, and image, while shared catalog details such as the
title, category, description, ingredients, allergens, and bestseller state remain on
the product. Variant images are uploaded to the public `product-images` Supabase
Storage bucket through the authenticated backend. JPEG, PNG, and WebP files up to
5 MB are accepted.

## Development

Install each application independently:

```bash
npm install --prefix backend
npm install --prefix frontend
npm install --prefix driver
```

Run the applications in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:driver
```

- Admin frontend: `http://localhost:5173`
- Admin API: `http://localhost:4322/api`
- API health: `http://localhost:4322/api/health`

See `driver/README.md` for mobile environment variables and device networking.

## Verification

From the repository root:

```bash
npm run check
npm run build
```

## AWS deployment

### Backend: Elastic Beanstalk

Build a source bundle whose root contains the backend `package.json` and compiled
`dist` directory:

```bash
cd backend
npm ci
npm run check
npm run build
zip -r romana-backend.zip package.json package-lock.json dist .platform
```

In Elastic Beanstalk, create a **Web server environment** using the current Node.js
on Amazon Linux 2023 platform and upload `backend/romana-backend.zip`. Set the health
check path to `/api/health` and configure the environment properties listed under
Supabase above. Set `NODE_ENV=production`; Elastic Beanstalk supplies `PORT`.

### Frontend: Amplify Hosting

Connect this GitHub repository and select the frontend as a monorepo application:

```text
App root: frontend
Environment variable: AMPLIFY_MONOREPO_APP_ROOT=frontend
```

Amplify will use the root `amplify.yml` to install and build the Vite app. After the
Beanstalk environment has HTTPS enabled, add this rule first under **Rewrites and
redirects**, replacing the target hostname:

```json
{
  "source": "/api/<*>",
  "target": "https://your-environment.example.com/api/<*>",
  "status": "200",
  "condition": null
}
```

This reverse proxy preserves the frontend's relative `/api` contract and same-site
authentication cookies. Set `FRONTEND_ORIGIN` in Beanstalk to the exact Amplify HTTPS
origin, `STOREFRONT_ORIGIN` to the public shop's exact origin, and `DRIVER_ORIGIN` to
the deployed driver web origin. Point Maya's webhook directly to
`https://your-backend.example/api/webhooks/maya`.
