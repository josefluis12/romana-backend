# Romana Shop Admin

The private administration system for the Romana online shop. It consists of two
independent TypeScript applications.

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
- `FRONTEND_ORIGIN`: the permitted admin frontend origin
- `STOREFRONT_ORIGIN`: the permitted public storefront origin

Create administrators as email/password users in Supabase Authentication. Any user
successfully authenticated by this Supabase project can access the admin portal.
Never put a secret or service-role key in the frontend or commit it to this repository.

Supabase CLI state is scoped to `backend/supabase`. Run Supabase commands from the
`backend` directory so future migrations remain part of the backend application.

Apply the checked-in migrations before using catalog management:

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
```

Run the applications in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

- Admin frontend: `http://localhost:5173`
- Admin API: `http://localhost:4322/api`
- API health: `http://localhost:4322/api/health`

## Verification

From the repository root:

```bash
npm run check
npm run build
```
