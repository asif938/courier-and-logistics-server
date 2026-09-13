# Courier & Logistics Platform — API

A backend-only RESTful API for a courier & logistics platform: shipment creation, courier assignment, hub-to-hub transit, delivery tracking, pricing, payments, and courier earnings. No frontend UI — designed to be exercised via Postman/Swagger.

> **Status:** Day 1 (Planning & Architecture) complete — roles/permissions, API plan, ERD, project scaffold, and the Prisma schema/migrations/seed are in place against a live Neon Postgres database. Auth, business logic, payments, and deployment land in the following days.

## Docs

- [`docs/01-roles-and-permissions.md`](docs/01-roles-and-permissions.md) — the 3 fixed roles (Customer, Courier, Admin) and exactly what each can do.
- [`docs/02-api-plan.md`](docs/02-api-plan.md) — the full endpoint plan (40+ routes) mapped to the mandatory API categories.
- [`docs/03-erd.md`](docs/03-erd.md) — entities, relationships, ERD, and the shipment status state machine.

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL + Prisma, Zod, Redis, JWT auth + Google social login, Stripe, Biome (lint/format).

## Getting started

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL/DIRECT_URL (Neon) and secrets as each phase adds them
npm run prisma:generate    # generate the Prisma client
npm run prisma:migrate      # apply migrations (interactive; use prisma:deploy in CI/non-interactive shells)
npm run db:seed              # seed zones, hubs, pricing rules, demo users, sample shipments
npm run dev                   # ts-node-dev, hot reload
npm run build && npm start     # production build
npm run lint                    # biome check
```

Health check: `GET /api/v1/health` (also verifies the database connection).

## Project structure

```
prisma/
  schema.prisma          # data model - see docs/03-erd.md for the rationale
  migrations/              # applied, checked-in SQL migrations
  seed.ts                    # zones, hubs, pricing rules, demo users, sample shipments
src/
  app.ts              # express app: security middleware, routes, error handling
  server.ts            # process entrypoint, graceful shutdown
  config/              # env loading, Prisma client singleton (driver-adapter based)
  generated/prisma/      # generated Prisma client (gitignored, run prisma:generate)
  middlewares/          # error handler, 404 handler (auth/rbac land Day 2)
  modules/              # one folder per feature: routes/controller/service/validation
    health/
  routes/v1/            # versioned router that mounts each module
  utils/                # ApiError, ApiResponse envelope helpers, catchAsync
docs/                  # planning docs (roles, API plan, ERD)
```

Each feature module (added from Day 2 onward) follows: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts`.

## Demo accounts

Seeded by `npm run db:seed`, all sharing one password for evaluation convenience:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@courierlogistics.dev` | `Passw0rd!123` |
| Customer | `alice@example.com` | `Passw0rd!123` |
| Customer (org member) | `bob@example.com` | `Passw0rd!123` |
| Courier | `carl@example.com` | `Passw0rd!123` |
| Courier | `dana@example.com` | `Passw0rd!123` |

Login endpoints land in Day 2 — these accounts (and password hashes) already exist in the database.
