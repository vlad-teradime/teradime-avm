# Teradime AVM — Claude Code Context

**This is the "AVM" (Asset Vantage Metrics) app** — a single-user-per-login app with no multi-tenant "clients" concept (just `users` with `admin`/`user` roles, and a deny-list `screeners` / `userScreenerAccess` access model). It is a **separate, sibling repo** from `teradime-finplan` ("Fin Planner" / "FinPlan", a multi-tenant financial planning app for advisors managing multiple clients), which lives at `..\teradime-finplan` relative to this directory. If a request refers to "Fin Planner," "FinPlan," or talks about clients/advisors, it belongs in that repo, not this one — do not implement FinPlan features here.

## Architecture

- `server/` — Express + Passport (local strategy, session-based auth)
- `server/storage.ts` — plain async `storage` object calling Drizzle directly (no `IStorage` interface, no JSON-file fallback — Postgres via `DATABASE_URL` is required)
- `server/screeners/<feature>/` — each feature ("screener") gets its own routes.ts + service module, registered in `server/index.ts`
- `shared/schema.ts` — Drizzle schema, single source of truth for the data model
- `analytics-service/` — separate Python FastAPI service (yfinance-backed market data), called via `ANALYTICS_SERVICE_URL`
- `client/src/` — React + Vite + wouter routing + Tailwind; minimal shadcn UI kit (not all primitives exist yet — check `client/src/components/ui/` before assuming a component is available)

## Feature Access

New features are registered as "screeners": call `storage.upsertScreener(key, name, description)` once at startup in `server/index.ts`, then gate routes with `requireScreenerAccess(key)` from `server/auth.ts`. Access is a **deny-list** — a user has access unless an admin has explicitly restricted them (a row exists in `userScreenerAccess`). No per-user enablement step is needed for a new screener to be usable.

## Migrations

Drizzle Kit (`npm run db:generate` / `npm run db:migrate`). Migration SQL should use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` so re-running is safe.
