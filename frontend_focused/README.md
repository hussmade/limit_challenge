# Submission workspace

A focused review workspace for broker-submitted opportunities. The list brings company, status, priority, owner and recent context together; the detail page keeps contacts, supporting files and the note timeline within reach. Filters and pagination are reflected in the URL, so a review can be bookmarked or resumed without rebuilding its context.

## Run locally

Use Python 3.13, Node.js 24 and npm. `scripts/setup` creates a virtual environment, installs the locked dependencies, generates a local secret, applies migrations and seeds sample data. It leaves existing environment files and data alone.

```sh
cd frontend_focused
./scripts/setup
./scripts/dev
```

Open [the workspace](http://127.0.0.1:3001). The API listens on `127.0.0.1:8001`. Keep the hostname consistent when signing in; `localhost` and `127.0.0.1` have separate cookies.

Local demo accounts are `operator` and `viewer`, both with password `Local-demo-2026!`. Set `DEMO_PASSWORD` before the first setup to choose another local demo password. Demo seeding is explicitly blocked when `DJANGO_DEBUG=false`. Existing account passwords are never reset by the seed command.

If Python uses another executable name, run `PYTHON_BIN=python3 ./scripts/setup`. On Windows, use WSL2 or Docker. To run services separately, use `./scripts/backend runserver 127.0.0.1:8001` and, from `frontend`, `npm run dev -- --port 3001`.

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
docker compose exec backend python manage.py seed_submissions
```

This starts PostgreSQL, Redis, a one-time migration job, Gunicorn and a production Next.js build. Only the frontend is published, on loopback port 3001. Stop any local dev server using that port first. `docker compose down` stops the stack and keeps the database volume. Do not add `--volumes` unless you intend to discard its data.

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

All endpoints require authentication. Responses preserve the scaffold’s camelCase field names. Submission lists use `{count, next, previous, results}`, with 12 records per page and a `pageSize` ceiling of 100. Broker options are returned as an unpaginated array for the dropdown.

| Endpoint                            | Behavior                                                             |
| ----------------------------------- | -------------------------------------------------------------------- |
| `GET /api/submissions/`             | Company, broker, owner, document/note counts and latest-note preview |
| `GET /api/submissions/{id}/`        | Full submission, contacts, documents and ordered notes               |
| `GET /api/brokers/`                 | Broker dropdown options                                              |
| `GET /api/submissions/summary/`     | Workspace-wide counts by status, independent of current filters      |
| `GET /api/documents/{id}/download/` | Authenticated download of a seeded demonstration document            |

The required `status`, `brokerId` and `companySearch` filters are implemented, along with all suggested extras: `createdFrom`, `createdTo`, `hasDocuments` and `hasNotes`. `priority` and ordering are included as small usability improvements. All supplied filters are combined with AND.

```text
/api/submissions/?status=in_review&brokerId=2&companySearch=Nova&hasDocuments=true&ordering=-createdAt&page=1
```

Supported ordering values are `-createdAt`, `createdAt`, `company` and `priority`. Priority sorts high before medium before low. IDs break sort ties so pagination is deterministic. Invalid dates, enum values, booleans and broker IDs return field-level 400 responses; missing records return 404. There are no mutation endpoints in this challenge, so POST, PATCH and DELETE return 405 for submissions.

## Decisions and tradeoffs

- This is an internal, single-company review tool. It does not make underwriting decisions, score applicants or send messages to brokers.
- The original domain model is retained. Indexes and a bounded `sample_content` field support realistic review fixtures and an actual downloadable file in the demo.
- A company can have multiple submissions. The row reference distinguishes them instead of treating a company name as a unique submission key.
- Date filters cover full UTC days, including the end date. Blank optional filters are omitted from requests. Invalid filter URLs show an error with a recovery action rather than quietly changing the search.
- Notes are a newest-first timeline. The supplied model has no parent-note relation, so there is no invented reply/threading model or note editor.
- Empty documents, contacts and notes are valid states. Seed data includes those cases rather than making every record look complete.
- Sample downloads are clearly labeled demonstration text files. External document links are allowed only for HTTPS URLs, open separately with `noopener noreferrer`, and are never fetched by the backend. Uploading files, malware scanning and object-storage permissions are outside this read-only brief.
- The list’s summary cards describe the whole workspace. The pager describes the filtered result set. The labels make this distinction visible.
- Apply controls commit a filter set together, reset the page and update the URL. Status tabs update immediately. Detail links preserve a validated return URL, and browser back/reload restore filter values.

The list performs two domain queries: count and data. Correlated subqueries fetch document/note counts and the latest note without multiplying rows across related tables. Detail uses four queries, regardless of the number of contacts, documents or notes. Related-count and query-budget tests guard both behaviors. The latest-note index starts with submission ID and follows the note chronology.

Broker options are intentionally unpaginated because the brief asks for a dropdown and the demo has five brokers. For a large broker directory, switch that control to paginated search. Company substring search is adequate for this dataset; a measured PostgreSQL trigram index is a reasonable next step at larger scale. We have not claimed a load-tested throughput target.

Optional scope delivered includes authentication, container tooling, CI, targeted backend/browser tests, accessibility checks and a production runbook. Live hosting was excluded at Hussein’s request.
