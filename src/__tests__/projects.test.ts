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

describe('list_projects', () => {
  it('returns project list on happy path', async () => {
    const fixture = [{ projectId: 'my-project-id', name: 'My Project' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_projects', {});
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: not authenticated');
    const result = await handleCallTool('list_projects', {});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('get_project', () => {
  it('returns project details on happy path', async () => {
    const fixture = { projectId: 'my-project-id', lifecycleState: 'ACTIVE' };
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('get_project', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id format', async () => {
    const result = await handleCallTool('get_project', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: project not found');
    const result = await handleCallTool('get_project', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('list_services', () => {
  it('returns enabled services on happy path', async () => {
    const fixture = [{ config: { name: 'compute.googleapis.com' } }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_services', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_services', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
  });
});

describe('get_billing_info', () => {
  it('returns billing info on happy path', async () => {
    const fixture = { billingAccountName: 'billingAccounts/AAAAAA-BBBBBB-CCCCCC', billingEnabled: true };
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('get_billing_info', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('get_billing_info', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: billing.resourceAssociations.get permission required');
    const result = await handleCallTool('get_billing_info', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('get_active_account', () => {
  it('returns { account, project } via two sequential raw runGcloud calls', async () => {
    // Two sequential runGcloud(..., true) calls — register two mocks before await.
    // raw=true means the source code calls `stdout.trim()` on the response (not JSON.parse),
    // so the mock stdout payload should be a plain string (NOT JSON.stringify'd).
    mockExecSuccess(mockExecFile, 'me@example.com\n');
    mockExecSuccess(mockExecFile, 'my-project-id\n');
    const result = await handleCallTool('get_active_account', {});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.account).toBe('me@example.com');
    expect(parsed.project).toBe('my-project-id');
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });

  it('returns EXECUTION_ERROR if first runGcloud (account) fails', async () => {
    mockExecError(mockExecFile, 'ERROR: not logged in');
    const result = await handleCallTool('get_active_account', {});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });

  it('returns EXECUTION_ERROR if second runGcloud (project) fails', async () => {
    mockExecSuccess(mockExecFile, 'me@example.com\n');
    mockExecError(mockExecFile, 'ERROR: no active project');
    const result = await handleCallTool('get_active_account', {});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});
