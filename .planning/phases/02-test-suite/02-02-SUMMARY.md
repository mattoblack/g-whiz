---
phase: "02"
plan: "02"
subsystem: "test-suite"
tags: [vitest, unit-tests, mocking, coverage]
dependency_graph:
  requires:
    - "02-01 (vitest infrastructure, handleCallTool export, helpers.ts)"
  provides:
    - "Unit tests for all 18 tool handlers in src/index.ts"
    - "Happy-path + error-path coverage per tool"
    - "White-box arg-order assertions for get_logs, list_cloud_run_services, list_compute_instances, list_gke_clusters, run_command"
  affects:
    - "src/__tests__/logging.test.ts (new)"
    - "src/__tests__/iam.test.ts (new)"
    - "src/__tests__/compute.test.ts (new)"
    - "src/__tests__/projects.test.ts (new)"
    - "src/__tests__/util.test.ts (new)"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted + vi.mock('node:child_process') callback-form mock pattern"
    - "mockExecSuccess / mockExecError helpers from helpers.ts"
    - "Dual-mock registration before await for Promise.all (get_service_account)"
    - "Dual-mock registration before await for sequential raw calls (get_active_account)"
    - "it.each table for exhaustive SHELL_META_RE coverage in run_command"
key_files:
  created:
    - "src/__tests__/logging.test.ts"
    - "src/__tests__/iam.test.ts"
    - "src/__tests__/compute.test.ts"
    - "src/__tests__/projects.test.ts"
    - "src/__tests__/util.test.ts"
  modified: []
decisions:
  - "Used longer SA name ('myaccount' 9 chars) in iam.test.ts to satisfy GCP_SA_EMAIL_RE which requires 6-30 chars before @; plan used 'sa' (2 chars) which fails the regex"
  - "WR-01 test uses 'myaccount@other-project-id.iam.gserviceaccount.com' (both email format valid, project segment mismatch) to isolate the project-segment check from the format check"
metrics:
  duration: "3m16s"
  completed: "2026-05-07"
  tasks_completed: 5
  tasks_total: 5
  files_created: 5
  files_modified: 0
---

# Phase 02 Plan 02: Domain Test Files Summary

**One-liner:** 79 unit tests across 5 domain files covering all 18 tool handlers with happy-path, validation rejection, and EXECUTION_ERROR paths; full suite green in 237ms.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | logging.test.ts (get_logs + list_log_sinks) | 4d90c7d | src/__tests__/logging.test.ts |
| 2 | iam.test.ts (list_service_accounts + get_service_account + list_roles) | cc7bca4 | src/__tests__/iam.test.ts |
| 3 | compute.test.ts (Cloud Run + Compute Engine + GKE) | aa5ceb5 | src/__tests__/compute.test.ts |
| 4 | projects.test.ts (5 project-tier tools) | 7824321 | src/__tests__/projects.test.ts |
| 5 | util.test.ts (run_command + 3 list tools) | 54ddecc | src/__tests__/util.test.ts |

## Test Count Per File

| File | Tests | Tools Covered |
|------|-------|---------------|
| logging.test.ts | 12 | get_logs (9), list_log_sinks (3) |
| iam.test.ts | 12 | list_service_accounts (3), get_service_account (5), list_roles (4) |
| compute.test.ts | 19 | list_cloud_run_services (5), get_cloud_run_service (4), list_compute_instances (5), list_gke_clusters (5) |
| projects.test.ts | 12 | list_projects (2), get_project (3), list_services (2), get_billing_info (3), get_active_account (2) |
| util.test.ts | 24 | run_command (14), list_buckets (3), list_firestore_databases (2), get_iam_policy (3) |
| **Total** | **79** | **18 tools** |

## Special Patterns Applied

### get_service_account — Promise.all dual-mock

Registered two `mockExecSuccess` calls before `await handleCallTool(...)`. Both mocks are consumed concurrently by `Promise.all([runGcloud(...), runGcloud(...)])`. Asserted `expect(mockExecFile).toHaveBeenCalledTimes(2)`.

### get_active_account — Sequential raw-string dual-mock

Registered two `mockExecSuccess` calls before `await handleCallTool(...)`. Both calls use `raw=true`, meaning `runGcloud` returns `stdout.trim()` rather than `JSON.parse(stdout)`. Mock stdout payloads are plain strings (`'me@example.com\n'`, `'my-project-id\n'`), NOT JSON-stringified.

### run_command — SHELL_META_RE exhaustive coverage

Used `it.each` table with 10 entries covering every character in `SHELL_META_RE = /[;&|`$<>\\()\n\r]/`: `&`, `|`, `` ` ``, `$`, `<`, `>`, `(`, `\n`, `\r`, `\`. Plus separate named test for `;` asserting the error message contains `'shell metacharacters'`. All assert `expect(mockExecFile).not.toHaveBeenCalled()`.

### White-box arg assertions

Five tools have white-box assertions on `mockExecFile.mock.calls[0]?.[1]`:
- `get_logs`: positional filter arg at index 2, `--project` after it, `--limit` after that
- `list_cloud_run_services`: `--region` flag presence/absence
- `list_compute_instances`: `--zones` flag presence/absence
- `list_gke_clusters`: `--location` flag with correct value
- `run_command`: exact `callArgs.toEqual(['projects', 'list', '--format=json'])` + `cmd === 'gcloud'`

## Deviations from Plan

### Auto-fixed Issue

**[Rule 1 - Bug] SA email test fixture used 2-char prefix 'sa' which fails GCP_SA_EMAIL_RE**

- **Found during:** Task 2 — first test run of iam.test.ts showed 3 failures
- **Issue:** Plan specified `sa@my-project-id.iam.gserviceaccount.com` as the valid SA email. `GCP_SA_EMAIL_RE` requires the SA name part to be 6-30 chars (`[a-z][a-z0-9-]{4,28}[a-z0-9]`). `'sa'` is only 2 chars and fails the regex. The 'happy path' test returned `isError: true` because email format validation rejected it before the handler logic ran.
- **Fix:** Changed all `get_service_account` test fixtures to use `'myaccount'` (9 chars) as the SA name prefix: `myaccount@my-project-id.iam.gserviceaccount.com`
- **WR-01 test impact:** The WR-01 project-mismatch test also needed updating. Used `myaccount@other-project-id.iam.gserviceaccount.com` — both email format and SA name are valid; only the project segment differs, triggering the intended `project segment` error message.
- **Files modified:** src/__tests__/iam.test.ts
- **Commit:** cc7bca4

## Known Stubs

None. All test assertions wire to actual `handleCallTool` return values — no placeholder data.

## Threat Flags

None. These are test-only files. No new production code surface was introduced.

## Self-Check: PASSED

Files verified:
- src/__tests__/logging.test.ts: EXISTS (commit 4d90c7d)
- src/__tests__/iam.test.ts: EXISTS (commit cc7bca4)
- src/__tests__/compute.test.ts: EXISTS (commit aa5ceb5)
- src/__tests__/projects.test.ts: EXISTS (commit 7824321)
- src/__tests__/util.test.ts: EXISTS (commit 54ddecc)

Full suite: `npx vitest run` — 5 test files, 79 tests, all passed, 237ms.

Tool coverage: 18 unique `describe(...)` blocks, one per tool name in src/index.ts switch statement.
