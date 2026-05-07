---
phase: 01-tool-depth-quality
plan: "04"
subsystem: billing-tools
tags: [billing, project-billing, permission-caveat]
dependency_graph:
  requires: [01-01-SUMMARY]
  provides: [get_billing_info]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [positional-project-id, permission-caveat-in-description]
key_files:
  created: []
  modified:
    - src/index.ts
decisions:
  - "Permission caveat documented in schema description so AI callers can self-correct on PERMISSION_DENIED"
  - "PERMISSION_DENIED error surfaces via existing outer catch without additional massaging (Pitfall 5)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-07"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 1 Plan 4: Billing Tool Summary

Added `get_billing_info` (PRJ-04) — surfaces the billing account linked to a GCP project. Single-tool plan due to the non-trivial permission requirement (`billing.resourceAssociations.get`) documented in the schema description.

## What Was Built

### get_billing_info (PRJ-04)

Schema includes permission caveat in description. Case body:
- Validates `project_id` against `GCP_PROJECT_ID_RE`
- Calls `runGcloud(["billing", "projects", "describe", project_id])` — `project_id` is a positional arg per RESEARCH.md

PERMISSION_DENIED errors from the cloudbilling API surface via the existing outer catch as `{ error: "EXECUTION_ERROR", message }` — the AI caller can read the error and suggest the user grant Billing Account Viewer.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-04-01 mitigation applied: project_id validated against regex and passed as separate array element.

## Self-Check

- [x] `src/index.ts` modified and committed (a7bda68)
- [x] `tsc --noEmit` exits 0
- [x] `get_billing_info` schema and case present (1 each)
- [x] `billing.resourceAssociations.get` in schema description
- [x] `["billing", "projects", "describe", project_id]` in case body

## Self-Check: PASSED
