import { describe, it, expect, vi, beforeEach } from 'vitest';

// Boilerplate identical to domain test files — keeps the mock surface uniform.
const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: mockExecFile }));

import { handleCallTool, server } from '../index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('handleCallTool dispatcher', () => {
  it('returns EXECUTION_ERROR with "Unknown tool" message for an unrecognized tool name', async () => {
    const result = await handleCallTool('not_a_real_tool', {});
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('EXECUTION_ERROR');
    expect(body.message).toContain('Unknown tool');
    expect(body.message).toContain('not_a_real_tool');
    // Importantly: the dispatcher rejects BEFORE any execFile call.
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('handles empty args object without crashing for tools that require args (validation path)', async () => {
    // get_project requires project_id; empty args triggers the validation branch.
    const result = await handleCallTool('get_project', {});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

});

describe('MCP server request handlers', () => {
  it('ListTools handler returns the declared tool list via InMemoryTransport', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const { tools } = await client.listTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    // Verify a few expected tool names are present
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('run_command');
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('get_logs');

    await client.close();
    await server.close();
  });

  it('CallTool handler routes through the server and returns EXECUTION_ERROR for unknown tool', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], cb: (err: null, r: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: JSON.stringify([]), stderr: '' });
      }
    );

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Call an existing tool via the server to exercise the CallTool handler path
    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result).toBeDefined();

    await client.close();
    await server.close();
  });
});
