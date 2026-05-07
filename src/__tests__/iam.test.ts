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

describe('list_service_accounts', () => {
  it('returns service accounts on happy path', async () => {
    const fixture = [{ email: 'sa@my-project-id.iam.gserviceaccount.com' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_service_accounts', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_service_accounts', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: forbidden');
    const result = await handleCallTool('list_service_accounts', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('get_service_account', () => {
  // GCP_SA_EMAIL_RE requires the SA name part (before @) to be 6-30 chars: [a-z][a-z0-9-]{4,28}[a-z0-9]
  // Use 'myaccount' (9 chars) to satisfy the regex.
  const validEmail = 'myaccount@my-project-id.iam.gserviceaccount.com';

  it('returns { account, keys } on happy path with two mocks', async () => {
    // Promise.all dispatches both calls — register both mocks BEFORE await.
    const accountFixture = { email: validEmail, displayName: 'My SA' };
    const keysFixture = [{ name: 'projects/.../keys/abc', validAfterTime: '2024-01-01' }];
    mockExecSuccess(mockExecFile, JSON.stringify(accountFixture));
    mockExecSuccess(mockExecFile, JSON.stringify(keysFixture));
    const result = await handleCallTool('get_service_account', {
      project_id: 'my-project-id',
      email: validEmail,
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.account).toEqual(accountFixture);
    expect(parsed.keys).toEqual(keysFixture);
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });

  it('returns INVALID_INPUT on bad email format', async () => {
    const result = await handleCallTool('get_service_account', {
      project_id: 'my-project-id',
      email: 'not-an-email',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns INVALID_INPUT when email project segment does not match project_id (WR-01)', async () => {
    // myaccount@other-project-id.iam.gserviceaccount.com — SA email format is valid
    // but project segment 'other-project-id' does not match project_id 'my-project-id'
    const result = await handleCallTool('get_service_account', {
      project_id: 'my-project-id',
      email: 'myaccount@other-project-id.iam.gserviceaccount.com',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(JSON.parse(result.content[0].text).message).toContain('project segment');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('get_service_account', {
      project_id: 'BAD!',
      email: validEmail,
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR when one of the two gcloud calls fails', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify({ email: validEmail }));
    mockExecError(mockExecFile, 'ERROR: keys list permission denied');
    const result = await handleCallTool('get_service_account', {
      project_id: 'my-project-id',
      email: validEmail,
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('list_roles', () => {
  it('returns roles on happy path (show_deleted=false default)', async () => {
    const fixture = [{ name: 'projects/my-project-id/roles/customRole' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_roles', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs).not.toContain('--show-deleted');
  });

  it('appends --show-deleted when show_deleted: true', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('list_roles', { project_id: 'my-project-id', show_deleted: true });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs).toContain('--show-deleted');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_roles', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: roles list failed');
    const result = await handleCallTool('list_roles', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});
