# Courier & Logistics Platform — API

A backend-only RESTful API for a courier & logistics platform: shipment creation, courier assignment, hub-to-hub transit, delivery tracking, pricing, real Stripe payments, notifications, and courier earnings. No frontend UI — exercised via Postman.

> **Status:** Core platform complete — 64 endpoints across auth (email/password + Google), users, zones, hubs, pricing, shipments (full state machine), payments (live Stripe), couriers, notifications, and admin (RBAC, dashboard stats, audit logs). Backed by an automated integration test suite and a runnable Postman collection.

## Docs

- [`docs/01-roles-and-permissions.md`](docs/01-roles-and-permissions.md) — the 3 fixed roles (Customer, Courier, Admin) and exactly what each can do.
- [`docs/02-api-plan.md`](docs/02-api-plan.md) — the full endpoint plan mapped to the mandatory API categories.
- [`docs/03-erd.md`](docs/03-erd.md) — entities, relationships, ERD, and the shipment status state machine.

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL + Prisma (driver adapters), Zod, Redis (rate limiting + caching, fails open when unavailable), JWT auth + Google social login, Stripe, Vitest + Supertest, Biome (lint/format).

## Getting started

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL/DIRECT_URL (Neon), JWT secrets, Stripe test keys, Google client ID
npm run prisma:generate       # generate the Prisma client
npm run prisma:migrate         # apply migrations (interactive; use prisma:deploy in CI/non-interactive shells)
npm run db:seed                 # seed zones, hubs, pricing rules, demo users, sample shipments
npm run dev                      # ts-node-dev, hot reload
npm run build && npm start        # production build
npm run lint                       # biome check
npm test                            # integration test suite (Vitest + Supertest, hits the real DB/Stripe)
```

Health check: `GET /api/v1/health` (verifies the database connection; reports Redis status separately since it's optional).

## API documentation (Postman)

A ready-to-import Postman collection lives in [`postman/`](postman/):

- `courier-logistics.postman_collection.json` — all 64 endpoints, organized into folders by resource (Auth, Users, Zones, Hubs, Pricing, Shipments, Couriers, Notifications, Payments, Admin), plus a final **End-to-End Demo** folder that runs the complete paid shipment lifecycle (create → pay via a real Stripe Checkout Session → pickup → courier auto-assignment → full status transitions → delivered → earnings) top to bottom.
- `courier-logistics.postman_environment.json` — sets `baseUrl` (defaults to `http://localhost:5000/api/v1`).

Import both into Postman, select the environment, and either run individual requests or use **Run Collection** for the whole suite. Login requests automatically capture access/refresh tokens into collection variables, so downstream requests authenticate themselves — no manual copy-pasting of tokens. The `Payments / Initiate Payment` and `End-to-End Demo` requests create a real Stripe test-mode Checkout Session; open the returned `checkoutUrl` in a browser and pay with `4242 4242 4242 4242` (any future expiry/CVC) to complete a payment for real.

The collection is generated from `scripts/generate-postman.ts` (so it can never drift silently out of sync by hand-editing) and was verified end-to-end with `newman` against a live server before being committed — every request passes. Regenerate after adding or changing routes:

```bash
npm run postman:generate
```

## Project structure

```
prisma/
  schema.prisma          # data model - see docs/03-erd.md for the rationale
  migrations/              # applied, checked-in SQL migrations
  seed.ts                    # zones, hubs, pricing rules, demo users, sample shipments
postman/                  # generated Postman collection + environment (see above)
scripts/
  generate-postman.ts       # source of truth for the Postman collection
  cleanup-postman-artifacts.ts  # removes data created by running the collection against a shared DB
tests/                    # Vitest + Supertest integration suite (auth, RBAC, edge cases, full shipment lifecycle)
src/
  app.ts              # express app: security middleware, routes, error handling
  server.ts            # process entrypoint, graceful shutdown
  config/              # env loading, Prisma/Redis/Stripe client singletons
  generated/prisma/      # generated Prisma client (gitignored, run prisma:generate)
  middlewares/          # auth, RBAC, validation, Redis-backed rate limiting, error handling
  modules/              # one folder per feature: routes/controller/service/validation
  routes/v1/            # versioned router that mounts each module
  utils/                # ApiError, ApiResponse envelope, pagination, caching, shared Prisma error handling
docs/                  # planning docs (roles, API plan, ERD) - not tracked in git
```

Each feature module follows: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts`.

## Demo accounts

Seeded by `npm run db:seed`, all sharing one password for evaluation convenience:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@courierlogistics.dev` | `Passw0rd!123` |
| Customer | `alice@example.com` | `Passw0rd!123` |
| Customer (org member) | `bob@example.com` | `Passw0rd!123` |
| Courier | `carl@example.com` | `Passw0rd!123` |
| Courier | `dana@example.com` | `Passw0rd!123` |
