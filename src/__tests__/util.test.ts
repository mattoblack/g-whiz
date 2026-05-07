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

describe('run_command', () => {
  it('tokenizes the command and runs gcloud with --format=json (white-box args assertion)', async () => {
    const fixture = [{ projectId: 'my-project-id' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('run_command', { command: 'projects list' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
    // Assert gcloud was invoked with [...tokens, '--format=json']
    const [cmd, callArgs] = mockExecFile.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('gcloud');
    expect(callArgs).toEqual(['projects', 'list', '--format=json']);
  });

  it('falls back to raw stdout when gcloud emits non-JSON', async () => {
    mockExecSuccess(mockExecFile, '  some plain text  ');
    const result = await handleCallTool('run_command', { command: 'help' });
    expect(result.isError).toBeUndefined();
    // The catch in run_command does `result = stdout.trim()`
    expect(JSON.parse(result.content[0].text)).toBe('some plain text');
  });

  it('returns INVALID_INPUT on empty command', async () => {
    const result = await handleCallTool('run_command', { command: '   ' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns INVALID_INPUT when command is not a string', async () => {
    const result = await handleCallTool('run_command', { command: 123 });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('rejects shell metacharacter `;` (QUAL-02)', async () => {
    const result = await handleCallTool('run_command', { command: 'projects list; rm -rf /' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(JSON.parse(result.content[0].text).message).toContain('shell metacharacters');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it.each([
    ['ampersand', 'projects list & echo bad'],
    ['pipe', 'projects list | grep foo'],
    ['backtick', 'projects list `whoami`'],
    ['dollar', 'projects list $HOME'],
    ['lt', 'projects list < /etc/passwd'],
    ['gt', 'projects list > /tmp/out'],
    ['paren', 'projects list (echo bad)'],
    ['newline', 'projects list\nrm bad'],
    ['cr', 'projects list\rrm bad'],
    ['backslash', 'projects list \\bad'],
  ])('rejects shell metacharacter (%s)', async (_label, command) => {
    const result = await handleCallTool('run_command', { command });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('returns EXECUTION_ERROR on gcloud stderr-only', async () => {
    mockExecError(mockExecFile, 'ERROR: invalid command');
    const result = await handleCallTool('run_command', { command: 'bogus subcommand' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('list_buckets', () => {
  it('returns buckets on happy path', async () => {
    const fixture = [{ name: 'my-bucket', storageClass: 'STANDARD' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_buckets', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_buckets', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: storage permission denied');
    const result = await handleCallTool('list_buckets', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
  });
});

describe('list_firestore_databases', () => {
  it('returns databases on happy path', async () => {
    const fixture = [{ name: 'projects/my-project-id/databases/(default)' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_firestore_databases', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_firestore_databases', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
  });
});

describe('get_iam_policy', () => {
  it('returns IAM policy on happy path', async () => {
    const fixture = { bindings: [{ role: 'roles/owner', members: ['user:me@example.com'] }] };
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('get_iam_policy', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('get_iam_policy', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: getIamPolicy permission denied');
    const result = await handleCallTool('get_iam_policy', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
  });
});
