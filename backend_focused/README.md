# Fleet workspace

A small operations workspace for vehicles, offices, mechanics and maintenance history. The overview puts overdue vehicles first, with office spending and workshop workload beside the service queue. Operators can manage all four resources; viewers can inspect the same information without write access.

## Run locally

Use Python 3.13, Node.js 24 and npm. `scripts/setup` creates a virtual environment, installs the locked dependencies, generates a local secret, applies migrations and seeds sample data. It leaves existing environment files and data alone.

```sh
cd backend_focused
./scripts/setup
./scripts/dev
```

Open [the workspace](http://127.0.0.1:3000). The API listens on `127.0.0.1:8000`. Keep the hostname consistent when signing in; `localhost` and `127.0.0.1` have separate cookies.

Local demo accounts are `operator` and `viewer`, both with password `Local-demo-2026!`. Set `DEMO_PASSWORD` before the first setup to choose another local demo password. Demo seeding is explicitly blocked when `DJANGO_DEBUG=false`. Existing account passwords are never reset by the seed command.

If Python uses another executable name, run `PYTHON_BIN=python3 ./scripts/setup`. On Windows, use WSL2 or Docker. To run services separately, use `./scripts/backend runserver 127.0.0.1:8000` and, from `frontend`, `npm run dev -- --port 3000`.

Environment examples are in `backend/.env.example`, `frontend/.env.example` and `.env.example`. Backend scripts load `backend/.env`; Django itself reads process environment variables. The browser always calls `/api/`. `API_INTERNAL_URL` controls the Next.js proxy destination and is baked into production builds.

## Checks

From this application directory:

```sh
./scripts/check
# With the app running in another terminal:
cd frontend
npx playwright install chromium
npm run test:e2e
```

`check` runs Python lint/format checks, migration drift detection, Django tests with coverage, TypeScript, ESLint, Prettier and a production build. Browser tests exercise the real API; run them against disposable demo data. They create and remove their own test records. Do not point them at a live company database.

To check a production frontend locally, stop `scripts/dev`, run `npm run build` in `frontend`, then run `./scripts/serve` from this directory. It starts Gunicorn and Next.js standalone output. The demo environment still uses HTTP; see the production notes before exposing it.

Backend tests use SQLite by default. Set `DATABASE_URL` to a disposable PostgreSQL database to run the same suite there. The database user needs permission to create the test database. CI runs PostgreSQL tests and Chromium workflows for both apps independently.

## Containers

After setup has generated the environment files:

```sh
docker compose up --build -d --wait
docker compose exec backend python manage.py seed_fleet
```

This starts PostgreSQL, Redis, a one-time migration job, Gunicorn and a production Next.js build. Only the frontend is published, on loopback port 3000. Stop any local dev server using that port first. `docker compose down` stops the stack and keeps the database volume. Do not add `--volumes` unless you intend to discard its data.

For a Docker-only setup, copy `.env.example` to `.env` and `backend/.env.example` to `backend/.env`, replace both password/secret placeholders with random values, and add `DEMO_PASSWORD=Local-demo-2026!` to the backend file if you want demo accounts. No Python or Node installation on the host is required for this path.

To run tests in the PostgreSQL container setup:

```sh
docker compose run --rm backend python manage.py test --settings=server.test_settings
```

The compose example is a local deployment rehearsal. Before a real deployment, use HTTPS, a trusted ingress, production secrets and production settings. See the production notes below for configuration and operational boundaries.

## Authentication and access

JWT access tokens live in HttpOnly cookies for five minutes. Refresh tokens rotate and are blacklisted when used or logged out. The browser renews sessions through a shared in-tab promise and, where supported, the Web Locks API across tabs. Unsafe cookie-authenticated requests require a CSRF token, including login, refresh and logout. Each application has its own cookie names, signing secret, token audience and user database.

There is no public registration. Accounts are managed by a trusted administrator. `is_staff` represents operator access; ordinary active users are viewers. Submission review remains read-only for either role. Password changes and deactivation revoke usable tokens through server-side user checks.

## Production notes

Set `DJANGO_DEBUG=false`, a random `DJANGO_SECRET_KEY` of at least 50 characters, explicit `DJANGO_ALLOWED_HOSTS`, HTTPS `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL` and `REDIS_URL`. Remove demo credentials. Terminate TLS at a trusted ingress and keep Django, PostgreSQL and Redis private. Enable `TRUST_PROXY=true` only when that ingress strips incoming forwarding headers and sets the verified original scheme. HSTS includes subdomains and preload; assess the domain before enabling this policy publicly.

Run `python manage.py check --deploy --fail-level WARNING` before accepting traffic. Apply migrations once per release and rehearse database backup restoration. Use immutable image digests for real releases; the included major-version image tags support the local rehearsal. Provision accounts through a trusted administrative process and assess SSO/MFA requirements for company data.

Refresh tokens expire eight hours after their latest rotation, so active sessions can last longer than eight hours. Logout revokes the refresh token; a copied access token can remain valid for up to five minutes unless its user is deactivated or their password changes. Schedule `flushexpiredtokens` daily. No scheduler or public deployment is provisioned here.

Redis shares throttle counters across workers, but DRF throttling is approximate under concurrency. Add ingress request limits and abuse protection before public exposure. `/health/` checks database/cache readiness; logs include request IDs, status, actor and duration without bodies, query strings or tokens. These logs are not an immutable audit ledger. The CSP uses script nonces and allows inline styles for Material UI. Keep authenticated responses out of shared caches.

Runtime Python and npm audits reported no known vulnerabilities during local verification. Full npm audits still report the development-only `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through Next.js lint tooling. No compatible patched release was offered at verification time; the suggested forced fix would downgrade lint tooling to another major version. Production standalone images exclude that tooling. Recheck the advisory during dependency updates. OS-image scanning, load testing and backup restoration were not performed in this exercise.

## Review material

The original assignment is preserved in [CHALLENGE.md](CHALLENGE.md). This README covers assumptions, API behavior and tradeoffs. The [AI engineering prompts](../docs/ai-collaboration.md) are labeled reconstructed examples.

To generate a short screen recording against running local demo services:

```sh
cd frontend
RECORD_DEMO=1 npx playwright test e2e/demo.spec.ts
```

The recording is written under `frontend/test-results`. Screenshots go to `docs/screenshots` at repository root. Generated recordings and screenshots are local artifacts excluded from version control. The walkthrough intentionally pauses to make the interaction readable. It uses only fictional sample data.

## API contract

All domain endpoints require authentication. Lists use `{count, next, previous, results}`, with 12 records by default and a maximum `pageSize` of 100. Costs are decimal strings in JSON to avoid floating-point rounding. Dates are ISO `YYYY-MM-DD`. IDs are database-generated integers.

| Endpoint                                         | Behavior                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `/api/offices/` and `/api/offices/{id}/`         | List/create and retrieve/update/delete offices                                        |
| `/api/vehicles/` and `/api/vehicles/{id}/`       | CRUD; detail includes office and complete maintenance history                         |
| `/api/mechanics/` and `/api/mechanics/{id}/`     | CRUD for mechanics                                                                    |
| `/api/maintenance/` and `/api/maintenance/{id}/` | CRUD for completed service records                                                    |
| `GET /api/offices/summary/`                      | Every office, active vehicle count, rolling 12-month cost and latest maintenance date |
| `GET /api/vehicles/{id}/history/`                | Paginated history, newest date and then highest ID first                              |
| `POST /api/vehicles/{id}/assign/`                | Body `{"office": 2}` changes the current office only                                  |
| `GET /api/mechanics/workload/`                   | Current-year service count and cost, busiest first; idle mechanics included           |
| `GET /api/vehicles/needing-maintenance/`         | Active vehicles with no service or a last service more than 365 days ago              |
| `GET /api/vehicles/duplicate-check/`             | Conflicting `vin` and/or `license_plate`; accepts `active` and `exclude_id`           |

Update with `PUT` or `PATCH`. Successful creates return 201; deletes return 204. Invalid input returns 400 with field messages, missing records return 404, insufficient permissions return 403, and protected deletions return 409. Unauthenticated access returns 401. Throttling returns 429.

Vehicle search accepts any combination of `office`, `active`, `make`, `model`, `maintenanceFrom`, `maintenanceTo`, `certification` and the general `search` field. For example:

```text
/api/vehicles/?office=1&active=true&make=Ford&maintenanceFrom=2026-01-01&maintenanceTo=2026-10-05&certification=ASE-100
```

Date and certification constraints must match the **same maintenance record**. This prevents a service performed by a different mechanic in a different year from accidentally satisfying the search. Search returns each vehicle once. Office and mechanic lists support `search`; mechanics also support `active`. Maintenance lists support `vehicle`, `mechanic` and `maintenance_type`.

## Domain decisions

- The company operates in USD. Costs include any tax and must be nonnegative, with at most two decimal places.
- UTC defines reporting dates. “Last 12 months” means the same calendar date a year ago through today, inclusive; February 29 maps to February 28 in a non-leap year. The maintenance-due rule is deliberately a separate **strictly more than 365 days** rule.
- VINs are uppercase, 17 characters, and exclude I, O and Q. This validates the identifier’s shape, not a region-specific checksum. Plates are trimmed and uppercase; internal spaces and punctuation remain meaningful.
- VINs are unique across active and inactive vehicles. Only active vehicles reserve a license plate. Reactivation must pass the same constraint as creation, including at the database level.
- Certification numbers are unique and normalized to uppercase. Maintenance categories are inspection, oil change, tires, brakes, repair and other.
- Future maintenance is rejected because this is a history of completed work, not a scheduling system. New records require an active vehicle and mechanic. Existing historical records can still be corrected after deactivation.
- Referenced offices, vehicles and mechanics cannot be deleted. Maintenance entries themselves have full CRUD, as required. Deactivation is the normal way to retire a vehicle or mechanic.
- Assignment stores only the new office. Historical costs therefore move with a vehicle into its current office’s report. This follows the brief; an accounting-grade cost-at-service-location ledger would need a different model.
- All summary offices and mechanics are returned, including those with no activity. Null maintenance dates are shown explicitly. Never-serviced vehicles appear first in the due queue.

## Query design and tradeoffs

The vehicle detail uses one joined query for vehicle/office and one prefetched query for all history/mechanic data. A test with 300 records holds it to two domain queries. Complete history is returned because the brief requests it; use the paginated history endpoint for larger histories.

Office summaries use a distinct vehicle count alongside maintenance sums, so multiple service records do not inflate the fleet count. Vehicle history/date/certification filters use `Exists` rather than joins that duplicate vehicles. Indexes support office/status lookup and vehicle/mechanic maintenance chronology. The database enforces active-plate uniqueness and nonnegative costs; API validation supplies useful messages, and an atomic write boundary handles uniqueness races.

The frontend uses explicit Apply controls for search/filter changes. This gives date ranges and combined filters one predictable submit action and avoids noisy browser history while typing. Related-record selectors search the API with cancellation and a short debounce. Forms wait for the server before showing success; there are no optimistic writes for money or assignments.

This intentionally does not add service scheduling, mileage-based intervals, assignment history, multi-company tenancy or a workflow engine. Concurrent edits to ordinary fields use last-write-wins; database constraints still protect uniqueness. A larger collaborative deployment should add record versions or ETags before introducing optimistic editing.
