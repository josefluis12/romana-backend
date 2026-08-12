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
- `ADMIN_EMAILS`: comma-separated Supabase Auth users allowed into the admin portal
- `FRONTEND_ORIGIN`: the permitted admin frontend origin

Create each administrator as an email/password user in Supabase Authentication and
include their normalized email in `ADMIN_EMAILS`. Never put a secret or service-role
key in the frontend or commit it to this repository.

Supabase CLI state is scoped to `backend/supabase`. Run Supabase commands from the
`backend` directory so future migrations remain part of the backend application.

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
