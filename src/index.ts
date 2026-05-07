#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGcloud(args: string[], raw = false): Promise<unknown> {
  const fullArgs = raw ? args : [...args, "--format=json"];
  const { stdout, stderr } = await execFileAsync("gcloud", fullArgs);
  if (stderr && !stdout) throw new Error(stderr.trim());
  if (raw) return stdout.trim();
  return JSON.parse(stdout);
}

const GCP_PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const GCP_SA_EMAIL_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.iam\.gserviceaccount\.com$/;
const GCP_REGION_RE = /^[a-z]+-[a-z]+\d+$/;
const GCP_ZONE_RE = /^[a-z]+-[a-z]+\d+-[a-z]$/;
const VALID_SEVERITIES = new Set(["DEFAULT","DEBUG","INFO","NOTICE","WARNING","ERROR","CRITICAL","ALERT","EMERGENCY"]);
const CLOUD_RUN_SERVICE_NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function validationError(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: "INVALID_INPUT", message }) }],
    isError: true as const,
  };
}


const server = new Server(
  { name: "g-whiz", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_command",
      description:
        "Run any gcloud CLI command. Use this as an escape hatch for anything not covered by other tools.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "gcloud subcommand and flags, e.g. 'compute instances list --project=my-project'",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "list_projects",
      description: "List all GCP projects the authenticated user can access.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_project",
      description: "Get details for a specific GCP project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_services",
      description: "List enabled APIs/services for a project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "get_logs",
      description: "Fetch recent Cloud Logging entries for a project with optional severity, resource type, and free-form filter.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          filter: {
            type: "string",
            description: "Optional Cloud Logging filter expression; combined with severity/resource_type via AND",
          },
          severity: {
            type: "string",
            description: "Optional severity floor (one of DEFAULT, DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY); maps to severity>=VALUE",
          },
          resource_type: {
            type: "string",
            description: "Optional Cloud Logging resource.type, e.g. cloud_run_revision, gce_instance, k8s_container",
          },
          limit: { type: "number", description: "Max entries to return (default 50)" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_log_sinks",
      description: "List Cloud Logging export sinks for a project. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_buckets",
      description: "List Cloud Storage buckets in a project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "get_iam_policy",
      description: "Get the IAM policy for a GCP project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_firestore_databases",
      description: "List Firestore databases in a project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_service_accounts",
      description: "List service accounts in a GCP project. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_roles",
      description: "List custom IAM roles defined in a GCP project. Read-only. Note: this returns only the project's custom roles, not the thousands of predefined GCP roles.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          show_deleted: {
            type: "boolean",
            description: "Include soft-deleted custom roles (default false)",
          },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_cloud_run_services",
      description: "List Cloud Run services in a GCP project. Read-only. Region is optional; when omitted, lists across all regions.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          region: {
            type: "string",
            description: "Optional region, e.g. us-central1. Omit to list across all regions.",
          },
        },
        required: ["project_id"],
      },
    },
    {
      name: "get_cloud_run_service",
      description: "Describe a specific Cloud Run service (status, URL, revisions). Read-only. Region is REQUIRED.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          service: {
            type: "string",
            description: "Cloud Run service name (lowercase, hyphens; max 63 chars)",
          },
          region: {
            type: "string",
            description: "Region the service is deployed to, e.g. us-central1. REQUIRED — gcloud will hang in non-TTY without it.",
          },
        },
        required: ["project_id", "service", "region"],
      },
    },
    {
      name: "list_compute_instances",
      description: "List Compute Engine instances in a GCP project. Read-only. Zones is optional; comma-separated list scopes the listing.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          zones: {
            type: "string",
            description: "Optional comma-separated list of zones, e.g. 'us-central1-a,us-central1-b'. Omit to list across all zones.",
          },
        },
        required: ["project_id"],
      },
    },
    {
      name: "list_gke_clusters",
      description: "List GKE clusters in a GCP project. Read-only. Location (region or zone) is optional; omit to list across all locations.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          location: {
            type: "string",
            description: "Optional region (e.g. us-central1) or zone (e.g. us-central1-a). Omit to list everywhere.",
          },
        },
        required: ["project_id"],
      },
    },
    {
      name: "get_billing_info",
      description: "Get the billing account linked to a GCP project. Read-only. Requires the caller to have billing.resourceAssociations.get permission on the project (typically Billing Account Viewer or Project Billing Manager).",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
        },
        required: ["project_id"],
      },
    },
    {
      name: "get_service_account",
      description: "Get details and key metadata for a specific service account. Read-only. Returns { account, keys }.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "GCP project ID" },
          email: {
            type: "string",
            description: "Service account email, e.g. name@project.iam.gserviceaccount.com",
          },
        },
        required: ["project_id", "email"],
      },
    },
    {
      name: "get_active_account",
      description: "Get the currently authenticated gcloud account and active project.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "run_command": {
        const command = args.command;
        if (typeof command !== "string" || !command.trim()) {
          return validationError("command must be a non-empty string");
        }
        // Reject shell metacharacters to prevent injection when args are forwarded to execFile
        const SHELL_META_RE = /[;&|`$<>\\()\n\r]/;
        if (SHELL_META_RE.test(command)) {
          return validationError("command must not contain shell metacharacters");
        }
        const parts = command.trim().split(/\s+/);
        const { stdout, stderr } = await execFileAsync("gcloud", [...parts, "--format=json"]);
        if (stderr && !stdout) throw new Error(stderr.trim());
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim(); // gcloud may emit non-JSON for some commands; preserve raw output
        }
        break;
      }

      case "list_projects":
        result = await runGcloud(["projects", "list"]);
        break;

      case "get_project": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        result = await runGcloud(["projects", "describe", project_id]);
        break;
      }

      case "list_services": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        result = await runGcloud(["services", "list", "--project", project_id]);
        break;
      }

      case "get_logs": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const limit = (args.limit as number) ?? 50;
        const severity = args.severity as string | undefined;
        const resource_type = args.resource_type as string | undefined;
        const userFilter = args.filter as string | undefined;

        if (severity && !VALID_SEVERITIES.has(severity)) {
          return validationError(`severity must be one of: ${[...VALID_SEVERITIES].join(", ")}`);
        }

        const parts: string[] = [];
        if (severity) parts.push(`severity>=${severity}`);
        if (resource_type) parts.push(`resource.type="${resource_type}"`);
        if (userFilter) parts.push(userFilter);
        const logFilter = parts.join(" AND ");

        const logArgs = ["logging", "read", "--project", project_id, "--limit", String(limit)];
        if (logFilter) logArgs.push(logFilter); // positional arg per RESEARCH.md Pitfall 1
        result = await runGcloud(logArgs);
        break;
      }

      case "list_log_sinks": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        result = await runGcloud(["logging", "sinks", "list", "--project", project_id]);
        break;
      }

      case "list_buckets": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        result = await runGcloud(["storage", "buckets", "list", "--project", project_id]);
        break;
      }

      case "get_iam_policy": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        result = await runGcloud(["projects", "get-iam-policy", project_id]);
        break;
      }

      case "list_firestore_databases": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        result = await runGcloud(["firestore", "databases", "list", "--project", project_id]);
        break;
      }

      case "list_service_accounts": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        result = await runGcloud(["iam", "service-accounts", "list", "--project", project_id]);
        break;
      }

      case "list_roles": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const show_deleted = args.show_deleted === true;
        const roleArgs = ["iam", "roles", "list", "--project", project_id];
        if (show_deleted) roleArgs.push("--show-deleted");
        result = await runGcloud(roleArgs);
        break;
      }

      case "list_cloud_run_services": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const region = args.region as string | undefined;
        if (region !== undefined && !GCP_REGION_RE.test(region)) {
          return validationError("region must match GCP region format, e.g. us-central1");
        }
        const runArgs = ["run", "services", "list", "--project", project_id];
        if (region) runArgs.push("--region", region);
        result = await runGcloud(runArgs);
        break;
      }

      case "get_cloud_run_service": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const service = args.service as string | undefined;
        if (!service || !CLOUD_RUN_SERVICE_NAME_RE.test(service)) {
          return validationError("service must be a valid Cloud Run service name (lowercase, hyphens; max 63 chars)");
        }
        const region = args.region as string | undefined;
        if (!region || !GCP_REGION_RE.test(region)) {
          return validationError("region is required for get_cloud_run_service (e.g. us-central1)");
        }
        result = await runGcloud([
          "run", "services", "describe", service,
          "--project", project_id,
          "--region", region,
        ]);
        break;
      }

      case "list_compute_instances": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const zones = args.zones as string | undefined;
        if (zones !== undefined) {
          // Validate each comma-separated zone individually
          const zoneList = zones.split(",").map((z) => z.trim()).filter((z) => z.length > 0);
          if (zoneList.length === 0 || !zoneList.every((z) => GCP_ZONE_RE.test(z))) {
            return validationError("zones must be a comma-separated list of GCP zones, e.g. us-central1-a,us-central1-b");
          }
        }
        const computeArgs = ["compute", "instances", "list", "--project", project_id];
        if (zones) computeArgs.push("--zones", zones);
        result = await runGcloud(computeArgs);
        break;
      }

      case "list_gke_clusters": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const location = args.location as string | undefined;
        if (location !== undefined && !GCP_REGION_RE.test(location) && !GCP_ZONE_RE.test(location)) {
          return validationError("location must be a GCP region (e.g. us-central1) or zone (e.g. us-central1-a)");
        }
        const gkeArgs = ["container", "clusters", "list", "--project", project_id];
        if (location) gkeArgs.push("--location", location);
        result = await runGcloud(gkeArgs);
        break;
      }

      case "get_billing_info": {
        const project_id = args.project_id as string | undefined;
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        result = await runGcloud(["billing", "projects", "describe", project_id]);
        break;
      }

      case "get_service_account": {
        const email = args.email as string | undefined;
        const project_id = args.project_id as string | undefined;
        if (!email || !GCP_SA_EMAIL_RE.test(email)) {
          return validationError("email must be a valid service account email (name@project.iam.gserviceaccount.com)");
        }
        if (!project_id || !GCP_PROJECT_ID_RE.test(project_id)) {
          return validationError("project_id must be a valid GCP project ID");
        }
        const [account, keys] = await Promise.all([
          runGcloud(["iam", "service-accounts", "describe", email, "--project", project_id]),
          runGcloud(["iam", "service-accounts", "keys", "list", "--iam-account", email, "--project", project_id]),
        ]);
        result = { account, keys };
        break;
      }

      case "get_active_account": {
        const account = await runGcloud(["config", "get-value", "account"], true);
        const project = await runGcloud(["config", "get-value", "project"], true);
        result = { account, project };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "EXECUTION_ERROR", message: (error as Error).message }) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
