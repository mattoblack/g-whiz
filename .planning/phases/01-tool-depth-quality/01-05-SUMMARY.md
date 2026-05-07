---
phase: 01-tool-depth-quality
plan: "05"
subsystem: compute-infra-tools
tags: [cloud-run, compute-engine, gke, infra, region-validation]
dependency_graph:
  requires: [01-01-SUMMARY]
  provides: [list_cloud_run_services, get_cloud_run_service, list_compute_instances, list_gke_clusters]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [required-region-for-describe, per-zone-validation, location-accepts-region-or-zone]
key_files:
  created: []
  modified:
    - src/index.ts
decisions:
  - "get_cloud_run_service requires region in schema AND validates at runtime (Pitfall 2: non-TTY hang)"
  - "CLOUD_RUN_SERVICE_NAME_RE added as file-local constant for service name validation"
  - "list_compute_instances validates each zone individually from comma-separated string"
  - "list_gke_clusters uses --location (accepts region or zone) per gcloud help recommendation"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 1 Plan 5: Compute/Infra Tools Summary

Added four compute/infrastructure read tools completing the Phase 1 tool set: `list_cloud_run_services` (INF-01), `get_cloud_run_service` (INF-02), `list_compute_instances` (INF-03), `list_gke_clusters` (INF-04). Together with IAM and logging tools, this enables end-to-end GCP debugging via MCP.

## What Was Built

### CLOUD_RUN_SERVICE_NAME_RE constant
`/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/` — file-local constant for Cloud Run service name validation.

### list_cloud_run_services (INF-01)
Validates `project_id`. Optional `region` validated against `GCP_REGION_RE` when provided. `--region region` appended conditionally.

### get_cloud_run_service (INF-02)
`region` is `required` in the input schema AND validated at runtime. This is the Pitfall 2 mitigation: without `--region`, `gcloud run services describe` prompts interactively and hangs the MCP server. `service` validated against `CLOUD_RUN_SERVICE_NAME_RE`.

### list_compute_instances (INF-03)
Optional `zones` (comma-separated string). Each zone split, trimmed, and individually validated against `GCP_ZONE_RE`. Entire string passed as single `--zones` argument element.

### list_gke_clusters (INF-04)
Optional `location` validated against `GCP_REGION_RE || GCP_ZONE_RE` (accepts either format). Passed via `--location` flag per gcloud help recommendation.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All STRIDE mitigations applied:
- T-05-01: CLOUD_RUN_SERVICE_NAME_RE validates service name before exec
- T-05-02: region required in schema + runtime (non-TTY hang prevention)
- T-05-03: each zone in comma-separated list validated with GCP_ZONE_RE
- T-05-04: GKE location validated against region or zone regex

## Self-Check

- [x] `src/index.ts` modified and committed (6718757)
- [x] `tsc --noEmit` exits 0
- [x] All 4 tool schemas registered (1 each)
- [x] All 4 switch cases present (1 each)
- [x] `CLOUD_RUN_SERVICE_NAME_RE` declared and used (2 occurrences)
- [x] `required: ["project_id", "service", "region"]` for get_cloud_run_service
- [x] Per-zone validation loop in list_compute_instances
- [x] `--location` used for GKE (not --region/--zone)

## Self-Check: PASSED
