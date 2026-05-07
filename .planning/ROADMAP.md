# Roadmap: g-whiz

**Goal:** Ship a polished public GCP MCP server to npm — well-scoped tools, tests, CI/CD, and a README that makes onboarding effortless.

**Milestone:** v1.0 public release

---

## Phase 1: Tool Depth & Quality

**Goal:** Replace the current broad-but-shallow 9-tool surface with a narrower, deeper, production-quality tool set covering the 4 domains users care about most.

**Requirements:** LOG-02, LOG-03, LOG-04, IAM-02, IAM-03, IAM-04, PRJ-04, INF-01, INF-02, INF-03, INF-04, QUAL-01, QUAL-02, QUAL-03

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Foundation: runGcloud helper + validation constants + retire legacy gcloud (QUAL-01/02/03)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Logs: get_logs severity + resource_type + list_log_sinks (LOG-02/03/04)
- [x] 01-03-PLAN.md — IAM: list_service_accounts + get_service_account + list_roles (IAM-02/03/04)
- [x] 01-04-PLAN.md — Projects: get_billing_info (PRJ-04)
- [x] 01-05-PLAN.md — Compute/Infra: Cloud Run, Compute, GKE tools (INF-01/02/03/04)

**Cross-cutting constraints:**
- npm run build still succeeds

**Deliverables:**
- Refactored `src/index.ts` with expanded tool handlers
- Safe argument interpolation throughout (no shell injection)
- Consistent JSON error responses across all tools
- All new tools: list_cloud_run_services, get_cloud_run_service, list_compute_instances, list_gke_clusters, list_service_accounts, get_service_account, list_roles, get_billing_info, list_log_sinks
- Enhanced get_logs with severity + resource type filtering

**Done when:** `npm run build` succeeds, all tools return structured responses, no raw string interpolation of user input into shell commands.

---

## Phase 2: Test Suite

**Goal:** Ship with a test suite that gives users and contributors confidence in the tool handlers.

**Requirements:** TEST-01, TEST-02, TEST-03

**Plans:** 3 plans

Plans:
**Wave 0**
- [x] 02-01-PLAN.md — Test infrastructure: install Vitest + coverage-v8, vitest.config.ts thresholds, extract handleCallTool export, helpers.ts mocks (TEST-01/02/03)

**Wave 1** *(blocked on Wave 0)*
- [x] 02-02-PLAN.md — Domain test files: logging, iam, compute, projects, util — happy + error paths for all 18 tools (TEST-01)

**Wave 2** *(blocked on Wave 1)*
- [x] 02-03-PLAN.md — Coverage gate: dispatcher default branch test, verify ≥80% coverage and non-zero exit on failure (TEST-02/03)

**Deliverables:**
- Vitest (or Jest) test suite in `src/__tests__/`
- Tests mock `execAsync` / `gcloud()` — no real GCP calls needed
- Each tool handler covered: happy path + error path
- `npm test` runs tests and exits non-zero on failure
- Coverage ≥ 80% on `src/index.ts`

**Done when:** `npm test` passes green, coverage meets threshold.

---

## Phase 3: CI/CD, README & npm Publish

**Goal:** Automate quality gates, nail the README, and ship v1.0 to npm.

**Requirements:** CI-01, CI-02, CI-03, DOC-01, DOC-02, DOC-03

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — CI workflow: .github/workflows/ci.yml build + test on push/PR (CI-01)
- [x] 03-02-PLAN.md — Publish workflow: .github/workflows/publish.yml + NPM_TOKEN secret checkpoint (CI-02, CI-03)
- [x] 03-03-PLAN.md — README.md + LICENSE + package.json v1.0.0 metadata (DOC-01, DOC-02, DOC-03)

**Wave 2** *(blocked on Wave 1)*
- [x] 03-04-PLAN.md — Verification: npm build/test/publish --dry-run + structural greps over all artifacts

**Deliverables:**
- `.github/workflows/ci.yml` — build + test on push/PR
- `.github/workflows/publish.yml` — publish to npm on `v*` tag
- `README.md` with: overview, prerequisites, install, MCP client config (Claude Desktop + Cursor), tool reference table
- `package.json` metadata: keywords, homepage, repository, license (MIT)
- `LICENSE` file (MIT)
- npm publish dry-run succeeds

**Done when:** CI passes on main, `npm publish --dry-run` succeeds, README covers all user onboarding steps.

---

## Summary

| Phase | Focus | Key Output |
|-------|-------|------------|
| 1 | Tool depth + quality | 18+ tools, safe, consistent |
| 2 | Test suite | Vitest, ≥80% coverage |
| 3 | CI/CD + docs + publish | GitHub Actions, README, npm |

**After Phase 3:** Tag `v1.0.0`, push, CI publishes to npm.

---
*Created: 2026-05-07*
