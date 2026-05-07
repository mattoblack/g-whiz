#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
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
      description: "Fetch recent Cloud Logging entries for a project.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          filter: {
            type: "string",
            description: "Log filter expression (optional)",
          },
          limit: {
            type: "number",
            description: "Max entries to return (default 50)",
          },
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
        // Escape hatch: uses exec() with shell interpolation by design (see CONTEXT.md D-01).
        // The MCP-calling AI is the intended caller; structured tools use runGcloud() instead.
        const command = args.command as string | undefined;
        if (!command || typeof command !== "string") {
          return validationError("command must be a non-empty string");
        }
        const { stdout, stderr } = await execAsync(`gcloud ${command} --format=json`);
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
          return validationError("project_id must be a valid GCP project ID (6-30 chars, lowercase letters/numbers/hyphens, start with letter, not end with hyphen)");
        }
        const limit = (args.limit as number) ?? 50;
        const userFilter = args.filter as string | undefined;
        const logArgs = ["logging", "read", "--project", project_id, "--limit", String(limit)];
        if (userFilter) logArgs.push(userFilter); // positional arg per RESEARCH.md Pitfall 1
        result = await runGcloud(logArgs);
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
