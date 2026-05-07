---
phase: 01-tool-depth-quality
plan: "03"
subsystem: iam-tools
tags: [iam, service-accounts, roles, parallel-calls]
dependency_graph:
  requires: [01-01-SUMMARY]
  provides: [list_service_accounts, get_service_account, list_roles]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [Promise.all-parallel-calls, sa-email-regex-validation, show-deleted-flag]
key_files:
  created: []
  modified:
    - src/index.ts
decisions:
  - "get_service_account uses Promise.all for parallel describe+keys calls per RESEARCH.md Pitfall 3"
  - "list_roles always passes --project to scope to custom roles only (Pitfall 6)"
  - "show_deleted pushed as boolean flag --show-deleted only when true"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 1 Plan 3: IAM Tools Summary

Added three IAM read tools: `list_service_accounts` (IAM-02), `get_service_account` (IAM-03), and `list_roles` (IAM-04). The two-call parallel pattern in `get_service_account` fulfills the "details and keys" requirement since `gcloud iam service-accounts describe` does not return key metadata.

## What Was Built

### list_service_accounts (IAM-02)
Validates `project_id`, calls `gcloud iam service-accounts list --project project_id`.

### list_roles (IAM-04)
Validates `project_id`, always passes `--project` (scopes to custom roles per Pitfall 6), conditionally appends `--show-deleted` as a boolean flag.

### get_service_account (IAM-03)
Validates `email` against `GCP_SA_EMAIL_RE` and `project_id` against `GCP_PROJECT_ID_RE`. Runs two calls in parallel via `Promise.all`:
1. `gcloud iam service-accounts describe email --project project_id`
2. `gcloud iam service-accounts keys list --iam-account email --project project_id`

Returns `{ account, keys }` merged result.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-03-01 and T-03-03 mitigations applied:
- SA email validated against GCP_SA_EMAIL_RE before exec
- list_roles unconditionally passes --project to prevent predefined role leak

## Self-Check

- [x] `src/index.ts` modified and committed (6536675, 070cae2)
- [x] `tsc --noEmit` exits 0
- [x] `list_service_accounts` case and schema present
- [x] `list_roles` case and schema with show_deleted present
- [x] `get_service_account` case with GCP_SA_EMAIL_RE.test, Promise.all, { account, keys }
- [x] --project always passed for list_roles

## Self-Check: PASSED
