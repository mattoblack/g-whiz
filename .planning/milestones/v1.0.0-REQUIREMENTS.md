# Requirements: g-whiz

**Defined:** 2026-05-07
**Core Value:** Let AI assistants navigate GCP infra without the developer leaving their conversation.

## v1 Requirements

### Tools — Logs & Observability

- [x] **LOG-01**: `get_logs` — fetch recent Cloud Logging entries with project + optional filter + limit
- [x] **LOG-02**: `get_logs` supports severity filter (ERROR, WARNING, INFO, DEBUG)
- [x] **LOG-03**: `get_logs` supports resource type filter (e.g. `Cloud Run Revision`)
- [x] **LOG-04**: `list_log_sinks` — list logging export sinks for a project

### Tools — IAM & Security

- [x] **IAM-01**: `get_iam_policy` — get project-level IAM policy
- [x] **IAM-02**: `list_service_accounts` — list service accounts in a project
- [x] **IAM-03**: `get_service_account` — get details and keys for a specific service account
- [x] **IAM-04**: `list_roles` — list custom IAM roles in a project

### Tools — Projects & Services

- [x] **PRJ-01**: `list_projects` — list all accessible GCP projects
- [x] **PRJ-02**: `get_project` — describe a specific project
- [x] **PRJ-03**: `list_services` — list enabled APIs for a project
- [x] **PRJ-04**: `get_billing_info` — get billing account linked to a project
- [x] **PRJ-05**: `get_active_account` — return current gcloud account + active project

### Tools — Compute & Infra

- [x] **INF-01**: `list_cloud_run_services` — list Cloud Run services in a project + region
- [x] **INF-02**: `get_cloud_run_service` — describe a specific Cloud Run service (status, URL, revisions)
- [x] **INF-03**: `list_compute_instances` — list Compute Engine instances
- [x] **INF-04**: `list_gke_clusters` — list GKE clusters in a project

### Tools — Utility

- [x] **UTIL-01**: `run_command` — escape hatch for any gcloud command
- [x] **UTIL-02**: `list_buckets` — list Cloud Storage buckets
- [x] **UTIL-03**: `list_firestore_databases` — list Firestore databases

### Quality

- [x] **QUAL-01**: All tools validate required inputs and return structured errors
- [x] **QUAL-02**: Command argument interpolation is safe (no shell injection risk)
- [x] **QUAL-03**: All tools return consistent JSON-serializable responses

### Testing

- [ ] **TEST-01**: Unit tests for all tool handler functions
- [ ] **TEST-02**: Test coverage ≥ 80% on `src/index.ts`
- [ ] **TEST-03**: Tests run with `npm test` and exit non-zero on failure

### CI/CD & Publishing

- [x] **CI-01**: GitHub Actions workflow runs build + test on every push/PR
- [x] **CI-02**: GitHub Actions publishes to npm on version tag push (`v*`)
- [x] **CI-03**: Package published to npm as `g-whiz` with `"files": ["dist"]`

### Documentation

- [x] **DOC-01**: README covers: what it is, prerequisites, install, MCP client config (Claude Desktop + Cursor)
- [x] **DOC-02**: README includes tool reference table
- [x] **DOC-03**: `package.json` has `description`, `keywords`, `homepage`, `repository`, `license`

## v2 Requirements

### Future Enhancements

- **V2-01**: `stream_logs` — real-time log tailing via SSE transport
- **V2-02**: `list_pubsub_topics` / `list_pubsub_subscriptions`
- **V2-03**: `query_bigquery` — run a BQ SQL query
- **V2-04**: MCP resource protocol support (expose GCP resources as MCP resources)
- **V2-05**: Windows support

## Out of Scope

| Feature | Reason |
|---------|--------|
| Docs site / landing page | README is sufficient for v1 |
| MCP registry listing | Post-v1 effort |
| GUI / web interface | stdio-only is the MCP standard for local servers |
| Auth management | Relies on ambient gcloud credentials by design |
| Windows support | Requires shell quoting changes; deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOG-02, LOG-03, LOG-04 | Phase 1 | Pending |
| IAM-02, IAM-03, IAM-04 | Phase 1 | Pending |
| PRJ-04 | Phase 1 | Complete |
| INF-01, INF-02, INF-03, INF-04 | Phase 1 | Pending |
| QUAL-01, QUAL-02, QUAL-03 | Phase 1 | Pending |
| TEST-01, TEST-02, TEST-03 | Phase 2 | Pending |
| CI-01, CI-02, CI-03 | Phase 3 | Pending |
| DOC-01, DOC-02, DOC-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 — initial project initialization*
