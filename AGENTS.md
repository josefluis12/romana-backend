# Romana Admin Engineering Guide

This file governs all work in this repository. Keep the admin portal dependable,
readable, secure, and easy for another engineer to extend.

## Repository Shape

Romana Admin is two independent applications:

- `frontend/`: React, TypeScript, and Vite. Runs on `http://localhost:5173`.
- `backend/`: Express, TypeScript, and Supabase integration. Runs on
  `http://localhost:4322`.
- The frontend calls relative `/api/*` paths. Vite proxies them to the backend in
  development.
- The backend owns authentication, authorization, validation, data access, and
  business rules. Never move those responsibilities into React.

Do not introduce Astro, Next.js, server rendering, or a second API layer unless the
user explicitly requests an architectural change.

## Core Standards

- Optimize for clarity before cleverness.
- Keep behavior explicit and control flow easy to follow.
- Use strict TypeScript. Do not add `any`; use `unknown` and narrow it safely.
- Give types, functions, variables, and components precise domain names.
- Prefer small composable functions over large multipurpose functions.
- Avoid speculative abstractions. Extract code when it has a clear responsibility,
  meaningful reuse, or independently testable behavior.
- Do not duplicate business rules, validation rules, route paths, or API contracts.
- Keep comments scarce. Explain why a non-obvious decision exists, not what the code
  visibly does.
- Delete dead code and unused exports while working in the affected area.
- Do not leave commented-out implementations, placeholder branches, or silent error
  handling.

## File And Function Limits

- A hand-written source file must not exceed 300 lines, including tests and styles.
- Treat 250 lines as the point to plan a split; do not wait until the hard limit.
- Generated files, lockfiles, and migration snapshots are exempt.
- Aim for functions below 50 lines. Split a function when it performs multiple jobs,
  requires repeated explanatory comments, or has deeply nested branches.
- Keep React components focused on one UI responsibility. A page coordinates
  components; it should not contain every component used by the page.
- Never reduce line count by compressing multiple statements or JSX elements onto one
  line. The limit exists to improve structure, not formatting density.

## Frontend Architecture

Use a Next.js App Router-inspired folder style while retaining React and Vite. The
names describe ownership and composition only; Vite does not create routes from the
filesystem automatically.

```text
src/
  app/
    App.tsx                 Root application and route table
    providers.tsx           Global React providers
    layout.tsx              Root shell shared by every route
    (auth)/
      login/
        page.tsx            Login route entry
        _components/        Components private to the login route
    (dashboard)/
      layout.tsx            Authenticated admin shell
      overview/
        page.tsx
        _components/
      orders/
        page.tsx
        _components/
      products/
        page.tsx
        _components/
      customers/
        page.tsx
        _components/
  components/
    ui/                     Reusable, domain-neutral controls
    shared/                 Reusable composed application UI
  features/                 Domain logic, hooks, and feature components
  hooks/                    Truly cross-feature React hooks
  lib/                      Framework-neutral helpers and configuration
  services/                 Typed HTTP clients grouped by API resource
  styles/                   Global styles, tokens, and reusable utilities
  types/                    Cross-feature frontend contracts
  main.tsx                  React bootstrap only
```

- Use lowercase kebab-case for route folders and PascalCase for reusable component
  filenames.
- Use `page.tsx` as a route's public entry point and `layout.tsx` for shared shells.
- Parenthesized folders such as `(auth)` and `(dashboard)` are organizational route
  groups. They do not become URL segments.
- Keep route-private code in `_components`, `_hooks`, or `_lib` beside its page. Move
  code upward only after it is genuinely shared by multiple routes.
- Register routes explicitly in `app/App.tsx` or a dedicated `app/routes.tsx`. Never
  assume Next.js-style filesystem routing exists in Vite.
- Keep `page.tsx` focused on page composition and orchestration. Put substantial UI in
  colocated components and business behavior in feature hooks or services.
- Do not create a generic `pages/` directory alongside `app/`; route entries belong in
  the `app/` tree.
- Use function components and hooks.
- Do not implement multiple full pages in one entry-point file.
- Keep `main.tsx` limited to creating the React root, rendering `App`, and importing
  global styles.
- Separate server state and HTTP calls from presentation components. Put API requests
  in typed service modules, not scattered through the component tree.
- Model loading, empty, success, and error states explicitly.
- Do not store authentication tokens in local storage, session storage, React state,
  or browser-readable cookies. Authentication uses backend-managed HTTP-only cookies.
- Send `credentials: "include"` for authenticated requests.
- Preserve CSRF handling for state-changing requests.
- Use controlled forms where field state or validation matters. Disable repeated
  submissions and show useful failure feedback.
- Use Lucide icons rather than hand-authored SVG markup when an appropriate icon
  exists.
- Use semantic HTML, visible focus styles, programmatic labels, and keyboard-operable
  controls. Icon-only buttons require an accessible name and tooltip.
- Keep styles responsive from 320px upward. Prevent overflow, text collisions, layout
  shifts, and controls that change size with dynamic content.
- Reuse design tokens for color, spacing, type, borders, and control sizes. Avoid
  one-off inline styles.

## Backend Architecture

As the API grows, organize `backend/src` into clear layers:

```text
src/
  routes/       Express route registration and HTTP concerns
  middleware/   Authentication, authorization, validation, and errors
  services/     Business workflows and external integrations
  repositories/ Database access and query composition
  schemas/      Request and response validation
  types/        Shared backend contracts
  config.ts     Validated environment configuration
  app.ts        Express composition only
  server.ts     Process startup only
```

- Route handlers translate HTTP input and output; they must not become the business
  logic or data-access layer.
- Validate every untrusted input at the API boundary, including params, query strings,
  JSON bodies, headers, and external API responses.
- Return consistent JSON errors without exposing stack traces, credentials, database
  details, or internal implementation details.
- Use centralized error handling as the number of routes grows.
- Keep `app.ts` free of process startup so tests can construct the application.
- Keep environment access inside `config.ts`; inject configuration or dependencies
  where tests need control.
- Use async code deliberately. Await operations that affect correctness and handle
  rejection paths.
- Avoid process-local state for behavior that must work across multiple deployed
  instances. Document temporary single-instance assumptions.

## Supabase And Security

- Never expose or commit the Supabase service-role key, database password, access
  token, refresh token, or any secret.
- The React app must never receive a service-role or secret key. It should not create a
  privileged Supabase client.
- Use `SUPABASE_URL` and a publishable key in `backend/.env`. Keep `.env` files ignored;
  document variable names with safe placeholders in `.env.example`.
- Enforce administrator access on the backend for every protected operation. Hiding a
  frontend page is not authorization.
- Preserve secure, HTTP-only, appropriately scoped cookies and CSRF checks.
- Use generic authentication errors so account existence is not disclosed.
- Apply rate limits to authentication and other abuse-sensitive endpoints.
- Enable RLS for every table in an exposed schema. Write policies around ownership or
  explicit authorization; `TO authenticated` alone is not authorization.
- Never use user-editable metadata for authorization decisions.
- Prefer least privilege. Do not use `SECURITY DEFINER` to work around permission
  errors.
- Make schema changes through reviewed migrations. Do not make undocumented production
  schema changes.

## API Contracts

- Keep request and response shapes typed and stable.
- Prefer resource-oriented endpoints under `/api`.
- Use the correct HTTP method and meaningful status codes.
- Avoid returning raw database rows when an explicit response DTO is safer or clearer.
- When a contract changes, update the backend implementation, frontend client, tests,
  and relevant documentation together.
- Paginate collection endpoints before their data can grow without bound.
- Make mutation operations safe against accidental duplicate submissions where the
  workflow requires it.

## Testing

- Add or update tests for every behavior change and bug fix.
- Backend tests should cover validation, authorization, success, and meaningful failure
  paths. Inject services rather than calling live Supabase from unit tests.
- Frontend tests should focus on user-observable behavior rather than implementation
  details when a test framework is introduced.
- Add integration coverage when behavior crosses routes, middleware, services, or API
  contracts.
- A bug fix should include a regression test whenever practical.
- Keep test data deterministic. Do not depend on execution order or a developer's live
  account.

## Dependencies And Generated Output

- Prefer platform APIs and existing dependencies before adding packages.
- Pin dependency versions and commit the relevant lockfile.
- Check maintenance, license, bundle cost, and security impact before adding a package.
- Do not manually edit generated output under `dist/` or dependency code under
  `node_modules/`.
- Do not commit `dist/`, `.env`, TypeScript build info, logs, or local editor state.

## Working Safely

- Read nearby code and tests before changing behavior.
- Keep changes scoped to the requested work. Avoid unrelated renaming or formatting.
- Preserve user changes in a dirty worktree; never reset or overwrite unrelated work.
- Do not perform destructive database, filesystem, or Git operations without explicit
  user approval.
- Do not silently change ports, environment names, cookie behavior, CORS policy, or API
  paths.
- Update `README.md` when setup, commands, architecture, or required environment
  variables change.

## Required Verification

Before declaring work complete, run from the repository root:

```bash
npm run check
npm run build
```

For frontend changes, also verify the relevant screen in a browser at desktop and
mobile widths. Check the browser console, failed network requests, overflow, focus
states, loading states, and error states.

For backend changes, exercise the affected endpoint and verify its status code and
response shape. For Supabase changes, run a real read-only verification query or a
targeted integration check against the intended environment after authorization is
available.

If a required check cannot run, report exactly what was not verified and why.

## Definition Of Done

Work is complete only when:

- Responsibilities are in the correct application and architectural layer.
- Every hand-written file remains at or below 300 lines.
- Types and API contracts are clear.
- Security boundaries and authorization are preserved.
- Relevant tests cover the change.
- `npm run check` and `npm run build` pass.
- Documentation matches actual setup and behavior.
- No secrets, generated output, debug code, or unrelated changes were introduced.
