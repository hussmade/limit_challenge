# Limit challenge applications

Two independent applications, built from the supplied Django REST Framework and Next.js scaffolds. Each owns its API, frontend, database, authentication, dependency locks, tests and container setup. Neither imports code from the other.

| Application          | What to review                                                                                                  | Runbook                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Fleet workspace      | Fleet CRUD, combined search, maintenance history, office reporting, mechanic workload and overdue service queue | [Fleet README](backend_focused/README.md)        |
| Submission workspace | URL-based filtering, paginated review, contacts, documents and notes                                            | [Submissions README](frontend_focused/README.md) |

Both include JWT sessions in HttpOnly cookies, CSRF protection, responsive layouts, recovery states and browser tests. Bonus scope includes the fleet frontend and authentication, plus submission authentication, container deployment tooling and CI. Live hosting was deliberately excluded.

## Start locally

Use Python 3.13 and Node.js 24. In one terminal:

```sh
cd backend_focused
./scripts/setup
./scripts/dev
```

In another terminal:

```sh
cd frontend_focused
./scripts/setup
./scripts/dev
```

Open [Fleet on port 3000](http://127.0.0.1:3000) and [Submissions on port 3001](http://127.0.0.1:3001). The local sample accounts are `operator` and `viewer`, with password `Local-demo-2026!`. These are development fixtures; production settings refuse demo seeding. The app runbooks also describe Docker-only setup and production build checks.

## Review path

Try a fleet service entry or filter submissions by broker, company and document availability. Filters survive reloads and navigation back from a detail page. Switch to the viewer account to inspect restricted fleet access.

The original briefs are preserved in [Fleet CHALLENGE.md](backend_focused/CHALLENGE.md) and [Submissions CHALLENGE.md](frontend_focused/CHALLENGE.md). The implementation adds practical controls without expanding into scheduling, underwriting, tenancy or file uploads.

Application READMEs include API contracts, assumptions, tradeoffs and production notes. The [AI engineering prompts](docs/ai-collaboration.md) contain reconstructed examples covering specific implementation issues. Generated screenshots and recordings remain local; each app includes a reproducible recording command.

Local verification passed 32 fleet and 24 submission backend tests against both SQLite and PostgreSQL, plus 10 Chromium workflows across the two apps. Python statement coverage was 95% and 88%, respectively. Browser checks included desktop/mobile layouts, keyboard navigation, error recovery and targeted axe accessibility scans. Both production builds and standalone startup checks passed.

Runtime dependency audits reported no known vulnerabilities at verification time. The development-only `braces` advisory in Next.js lint tooling remains documented below in each application README. Safari, Firefox, physical devices, load testing and a public TLS deployment were not tested.

Run `./scripts/check` inside either app for backend checks, frontend checks and a production build. Run `npm run test:e2e` from its frontend against the running demo services. The repository includes a separate CI matrix entry for each application. Check the branch’s GitHub Actions results for hosted CI status.
