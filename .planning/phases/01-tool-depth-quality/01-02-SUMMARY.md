---
phase: 01-tool-depth-quality
plan: "02"
subsystem: logging-tools
tags: [logging, severity, resource-type, filter, list-sinks]
dependency_graph:
  requires: [01-01-SUMMARY]
  provides: [enhanced-get_logs, list_log_sinks]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [AND-filter-construction, severity-allowlist, positional-log-filter-arg]
key_files:
  created: []
  modified:
    - src/index.ts
decisions:
  - "Log filter passed as positional arg (not --filter flag) per RESEARCH.md Pitfall 1"
  - "Severity validated against VALID_SEVERITIES set before any subprocess call"
  - "Filter parts joined by AND only for non-empty parts; empty filter omits positional arg"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 1 Plan 2: Logging Enhancements Summary

Enhanced `get_logs` with severity floor and resource_type scoping (LOG-02, LOG-03), and added `list_log_sinks` for logging export sink enumeration (LOG-04). Filter parts are assembled with AND logic and passed as a single positional arg to `gcloud logging read`.

## What Was Built

### get_logs enhancement (LOG-02, LOG-03)

Updated tool schema exposes `severity`, `resource_type`, `filter`, `limit`, `project_id`. Case body:

- Validates `severity` against the 9-value `VALID_SEVERITIES` allowlist; returns `INVALID_INPUT` on mismatch
- Builds `parts[]` from non-empty severity/resource_type/userFilter, joined by ` AND `
- Pushes the assembled filter as a **positional arg** (not `--filter`) to `runGcloud` — per Pitfall 1

### list_log_sinks (LOG-04)

New tool schema and switch case:
- Validates `project_id` against `GCP_PROJECT_ID_RE`
- Calls `runGcloud(["logging", "sinks", "list", "--project", project_id])`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new trust boundaries. T-02-01 and T-02-02 mitigations applied:
- Filter assembled as a single positional arg element; execFile prevents metachar escape
- Severity allowlist check rejects non-allowlist values before runGcloud

## Self-Check

- [x] `src/index.ts` modified and committed (a52c74b)
- [x] `tsc --noEmit` exits 0
- [x] `severity` and `resource_type` present in get_logs schema
- [x] `VALID_SEVERITIES.has(severity)` check present
- [x] `parts.join(" AND ")` present
- [x] `list_log_sinks` case and schema present
- [x] No `--filter` flag used for logging read

## Self-Check: PASSED
