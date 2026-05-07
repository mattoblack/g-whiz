# g-whiz

g-whiz is a Model Context Protocol (MCP) server that exposes Google Cloud Platform operations to AI assistants. It wraps the gcloud CLI over stdio, uses your existing gcloud auth — no separate credentials, no API keys — and ships 18 tools across logs, IAM, projects, and compute.

## Prerequisites

- Node.js 22 LTS or newer
- `gcloud` CLI installed and authenticated (`gcloud auth login` or service account ADC)
- An MCP-capable client (Claude Desktop, Cursor, etc.)

## Install

**Quick start (zero-install via npx):** The MCP client config below invokes g-whiz via `npx` — no manual install needed.

**Global install (alternative):** Install once and reference `g-whiz` directly as the `command` in MCP config instead of `npx`.

```bash
npm install -g g-whiz
```

## MCP Client Configuration

### Claude Desktop

Config file location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "g-whiz": {
      "command": "npx",
      "args": ["-y", "g-whiz"]
    }
  }
}
```

Claude Desktop must be fully quit and restarted after editing the config (closing the window is not enough).

### Cursor

Config file location:
- Global: `~/.cursor/mcp.json`
- Project-scoped: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "g-whiz": {
      "command": "npx",
      "args": ["-y", "g-whiz"]
    }
  }
}
```

## Tools

### Logs & Observability

| Tool | Description |
|------|-------------|
| `get_logs` | Fetch recent Cloud Logging entries for a project with optional severity, resource type, and free-form filter |
| `list_log_sinks` | List Cloud Logging export sinks for a project. Read-only |

### IAM & Security

| Tool | Description |
|------|-------------|
| `get_iam_policy` | Get the IAM policy for a GCP project |
| `list_service_accounts` | List service accounts in a GCP project. Read-only |
| `get_service_account` | Get details and key metadata for a specific service account. Read-only. Returns `{ account, keys }` |
| `list_roles` | List custom IAM roles defined in a GCP project. Read-only |

### Projects & Services

| Tool | Description |
|------|-------------|
| `list_projects` | List all GCP projects the authenticated user can access |
| `get_project` | Get details for a specific GCP project |
| `list_services` | List enabled APIs/services for a project |
| `get_billing_info` | Get the billing account linked to a GCP project |
| `get_active_account` | Get the currently authenticated gcloud account and active project |

### Compute & Infra

| Tool | Description |
|------|-------------|
| `list_cloud_run_services` | List Cloud Run services in a GCP project. Optional region; omit to list across all regions |
| `get_cloud_run_service` | Describe a specific Cloud Run service (status, URL, revisions). Region required |
| `list_compute_instances` | List Compute Engine instances in a GCP project. Optional zones (comma-separated) |
| `list_gke_clusters` | List GKE clusters in a GCP project. Optional location (region or zone) |
| `list_buckets` | List Cloud Storage buckets in a project |
| `list_firestore_databases` | List Firestore databases in a project |

### Utility

| Tool | Description |
|------|-------------|
| `run_command` | Run any gcloud CLI command. Escape hatch for commands not covered by other tools |

## Authentication

g-whiz uses your local gcloud credentials — it does not store or request its own. Authenticate once with `gcloud auth login` (or configure service account ADC), and g-whiz inherits those credentials automatically. To switch projects, run `gcloud config set project <id>` or use the `run_command` tool.

## License

MIT — see [LICENSE](./LICENSE).
