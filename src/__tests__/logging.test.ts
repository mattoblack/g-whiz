import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockExecSuccess, mockExecError } from './helpers.js'

// vi.hoisted runs before imports; vi.mock factory closes over mockExecFile.
const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }))

// MUST use 'node:child_process' (with node: prefix) to match src/index.ts import.
vi.mock('node:child_process', () => ({ execFile: mockExecFile }))

// Must come AFTER vi.mock — Vitest hoists vi.mock above all imports.
import { handleCallTool } from '../index.js'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('get_logs', () => {
  it('returns logs on happy path with severity, resource_type, filter, and limit', async () => {
    const fixture = [{ insertId: 'log-1', textPayload: 'hello' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('get_logs', {
      project_id: 'my-project-id',
      severity: 'ERROR',
      resource_type: 'cloud_run_revision',
      filter: 'textPayload="hello"',
      limit: 10,
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);

    // White-box: positional filter must come BEFORE --project / --limit flags (WR-05).
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs[0]).toBe('logging');
    expect(callArgs[1]).toBe('read');
    // The 3rd arg is the joined filter string; assert it joins severity AND resource AND user filter.
    expect(callArgs[2]).toContain('severity>=ERROR');
    expect(callArgs[2]).toContain('resource.type="cloud_run_revision"');
    expect(callArgs[2]).toContain('textPayload="hello"');
    // --project and --limit come AFTER the positional filter
    const projectFlagIdx = callArgs.indexOf('--project');
    const limitFlagIdx = callArgs.indexOf('--limit');
    expect(projectFlagIdx).toBeGreaterThan(2);
    expect(limitFlagIdx).toBeGreaterThan(projectFlagIdx);
    expect(callArgs[limitFlagIdx + 1]).toBe('10');
  });

  it('uses DEFAULT_LOG_LIMIT (50) when limit is omitted', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('get_logs', { project_id: 'my-project-id' });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs[callArgs.indexOf('--limit') + 1]).toBe('50');
  });

  it('clamps limit to 1000 when caller exceeds it', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('get_logs', { project_id: 'my-project-id', limit: 99999 });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs[callArgs.indexOf('--limit') + 1]).toBe('1000');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('get_logs', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns INVALID_INPUT on unknown severity', async () => {
    const result = await handleCallTool('get_logs', { project_id: 'my-project-id', severity: 'VERBOSE' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns INVALID_INPUT on bad resource_type characters', async () => {
    const result = await handleCallTool('get_logs', {
      project_id: 'my-project-id',
      resource_type: 'Cloud Run Revision',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT on user filter with disallowed characters', async () => {
    const result = await handleCallTool('get_logs', {
      project_id: 'my-project-id',
      filter: 'bad; filter',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT on user filter exceeding 256 chars', async () => {
    const longFilter = 'a'.repeat(257);
    const result = await handleCallTool('get_logs', {
      project_id: 'my-project-id',
      filter: longFilter,
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR when gcloud emits stderr only', async () => {
    mockExecError(mockExecFile, 'ERROR: permission denied');
    const result = await handleCallTool('get_logs', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('list_log_sinks', () => {
  it('returns sinks on happy path', async () => {
    const fixture = [{ name: 'my-sink', destination: 'storage.googleapis.com/...' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_log_sinks', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_log_sinks', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: not authorized');
    const result = await handleCallTool('list_log_sinks', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});
