#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function gcloud(args: string, raw = false): Promise<unknown> {
  const cmd = raw ? `gcloud ${args}` : `gcloud ${args} --format=json`;
  const { stdout, stderr } = await execAsync(cmd);
  if (stderr && !stdout) throw new Error(stderr.trim());
  if (raw) return stdout.trim();
  return JSON.parse(stdout);
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
      case "run_command":
        result = await gcloud(args.command as string);
        break;

      case "list_projects":
        result = await gcloud("projects list");
        break;

      case "get_project":
        result = await gcloud(`projects describe ${args.project_id}`);
        break;

      case "list_services":
        result = await gcloud(`services list --project=${args.project_id}`);
        break;

      case "get_logs": {
        const limit = (args.limit as number) ?? 50;
        const filter = args.filter
          ? `--filter="${args.filter as string}"`
          : "";
        result = await gcloud(
          `logging read ${filter} --project=${args.project_id as string} --limit=${limit}`
        );
        break;
      }

      case "list_buckets":
        result = await gcloud(
          `storage buckets list --project=${args.project_id as string}`
        );
        break;

      case "get_iam_policy":
        result = await gcloud(
          `projects get-iam-policy ${args.project_id as string}`
        );
        break;

      case "list_firestore_databases":
        result = await gcloud(
          `firestore databases list --project=${args.project_id as string}`
        );
        break;

      case "get_active_account": {
        const account = await gcloud("config get-value account", true);
        const project = await gcloud("config get-value project", true);
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
      content: [
        { type: "text", text: `Error: ${(error as Error).message}` },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
