# Romana Shop Admin

The private operations portal for the Romana online shop.

## Project structure

```text
backend/
  src/      TypeScript server and business logic
  test/     Backend unit and integration tests
  dist/     Compiled JavaScript (generated)
public/     Static assets for the admin interface
```

All authentication, authorization, validation, data access, and future shop business
logic belongs under `backend/src`. The `public` folder contains browser assets only.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Create the administrator in Supabase Authentication, then put the project's URL and
publishable key in `.env`. Open `http://localhost:4322` and sign in with that user's
email and password. A legacy anon key can be supplied as `SUPABASE_ANON_KEY` if the
project does not yet expose a publishable key. Set `ADMIN_EMAILS` to a comma-separated
allowlist of users permitted to enter the operations portal.

Never put the Supabase service-role key in this application. The server refuses to
start in production if the project URL, public key, or administrator allowlist is
missing.

## Current scope

- Secure administrator sign-in and sign-out
- Supabase email/password authentication
- HTTP-only, same-site access and refresh token cookies
- Server-side token validation and automatic session refresh
- CSRF-protected sign-out
- Sign-in throttling and baseline security headers
- Responsive shop overview shell

Login throttling is held in memory for this first single-instance portal slice. Move
it to a shared rate-limit store when deploying across multiple server instances.

## Commands

```bash
npm run dev        # Run the TypeScript backend with file watching
npm run typecheck  # Validate strict TypeScript types
npm test           # Run backend tests
npm run build      # Compile backend/src into backend/dist
npm start          # Run the compiled backend
```
