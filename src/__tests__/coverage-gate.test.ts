import { describe, it, expect, vi, beforeEach } from 'vitest';

// Boilerplate identical to domain test files — keeps the mock surface uniform.
const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: mockExecFile }));

import { handleCallTool } from '../index.js';

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
