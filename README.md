# Courier & Logistics Platform — API

A backend-only RESTful API for a courier & logistics platform: shipment creation, courier assignment, hub-to-hub transit, delivery tracking, pricing, payments, and courier earnings. No frontend UI — designed to be exercised via Postman/Swagger.

> **Status:** Day 1 (Planning & Architecture) in progress. See `docs/` for the roles/permissions model, the full API plan, and the ERD. Database (Prisma + PostgreSQL), auth, business logic, payments, and deployment land in the following days.

## Docs

- [`docs/01-roles-and-permissions.md`](docs/01-roles-and-permissions.md) — the 3 fixed roles (Customer, Courier, Admin) and exactly what each can do.
- [`docs/02-api-plan.md`](docs/02-api-plan.md) — the full endpoint plan (40+ routes) mapped to the mandatory API categories.
- [`docs/03-erd.md`](docs/03-erd.md) — entities, relationships, ERD, and the shipment status state machine.

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL + Prisma, Zod, Redis, JWT auth + Google social login, Stripe, Biome (lint/format).

## Getting started

```bash
npm install
cp .env.example .env   # fill in secrets once each phase adds them
npm run dev             # ts-node-dev, hot reload
npm run build && npm start   # production build
npm run lint             # biome check
```

Health check: `GET /api/v1/health`.

## Project structure

```
src/
  app.ts              # express app: security middleware, routes, error handling
  server.ts            # process entrypoint, graceful shutdown
  config/              # env loading (and later: db, redis, stripe clients)
  middlewares/          # error handler, 404 handler (auth/rbac land Day 2)
  modules/              # one folder per feature: routes/controller/service/validation
    health/
  routes/v1/            # versioned router that mounts each module
  utils/                # ApiError, ApiResponse envelope helpers, catchAsync
docs/                  # planning docs (roles, API plan, ERD)
```

Each feature module (added from Day 2 onward) follows: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts`.

## Admin demo credentials

Will be provisioned via the seed script and published here once the database/seed step (Day 1 Phase 6) lands.
