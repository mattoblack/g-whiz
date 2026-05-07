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

describe('list_cloud_run_services', () => {
  it('returns services on happy path without region (lists across all regions)', async () => {
    const fixture = [{ metadata: { name: 'svc-1' } }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_cloud_run_services', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs).not.toContain('--region');
  });

  it('appends --region when region is provided', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('list_cloud_run_services', { project_id: 'my-project-id', region: 'us-central1' });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    const idx = callArgs.indexOf('--region');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(callArgs[idx + 1]).toBe('us-central1');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_cloud_run_services', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT on bad region', async () => {
    const result = await handleCallTool('list_cloud_run_services', {
      project_id: 'my-project-id',
      region: 'US-CENTRAL1',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: run.googleapis.com not enabled');
    const result = await handleCallTool('list_cloud_run_services', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('get_cloud_run_service', () => {
  it('returns service description on happy path', async () => {
    const fixture = { metadata: { name: 'my-svc' }, status: { url: 'https://my-svc-...run.app' } };
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('get_cloud_run_service', {
      project_id: 'my-project-id',
      service: 'my-svc',
      region: 'us-central1',
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('returns INVALID_INPUT on bad service name', async () => {
    const result = await handleCallTool('get_cloud_run_service', {
      project_id: 'my-project-id',
      service: 'My-Svc',
      region: 'us-central1',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT when region is missing (required)', async () => {
    const result = await handleCallTool('get_cloud_run_service', {
      project_id: 'my-project-id',
      service: 'my-svc',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(JSON.parse(result.content[0].text).message).toContain('region');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('get_cloud_run_service', {
      project_id: 'BAD!',
      service: 'my-svc',
      region: 'us-central1',
    });
    expect(result.isError).toBe(true);
  });
});

describe('list_compute_instances', () => {
  it('returns instances on happy path without zones', async () => {
    const fixture = [{ name: 'vm-1', zone: 'projects/.../zones/us-central1-a' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_compute_instances', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(callArgs).not.toContain('--zones');
  });

  it('appends --zones when zones provided', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('list_compute_instances', {
      project_id: 'my-project-id',
      zones: 'us-central1-a,us-central1-b',
    });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    const idx = callArgs.indexOf('--zones');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(callArgs[idx + 1]).toBe('us-central1-a,us-central1-b');
  });

  it('returns INVALID_INPUT when zones list contains a malformed zone', async () => {
    const result = await handleCallTool('list_compute_instances', {
      project_id: 'my-project-id',
      zones: 'us-central1-a,not-a-zone',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_compute_instances', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: compute API not enabled');
    const result = await handleCallTool('list_compute_instances', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });
});

describe('list_gke_clusters', () => {
  it('returns clusters on happy path without location', async () => {
    const fixture = [{ name: 'gke-1', location: 'us-central1' }];
    mockExecSuccess(mockExecFile, JSON.stringify(fixture));
    const result = await handleCallTool('list_gke_clusters', { project_id: 'my-project-id' });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it('accepts a region as location', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('list_gke_clusters', { project_id: 'my-project-id', location: 'us-central1' });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    const idx = callArgs.indexOf('--location');
    expect(callArgs[idx + 1]).toBe('us-central1');
  });

  it('accepts a zone as location', async () => {
    mockExecSuccess(mockExecFile, JSON.stringify([]));
    await handleCallTool('list_gke_clusters', { project_id: 'my-project-id', location: 'us-central1-a' });
    const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
    const idx = callArgs.indexOf('--location');
    expect(callArgs[idx + 1]).toBe('us-central1-a');
  });

  it('returns INVALID_INPUT on bad location', async () => {
    const result = await handleCallTool('list_gke_clusters', {
      project_id: 'my-project-id',
      location: 'NOT-A-LOCATION',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
  });

  it('returns EXECUTION_ERROR on gcloud stderr', async () => {
    mockExecError(mockExecFile, 'ERROR: container API not enabled');
    const result = await handleCallTool('list_gke_clusters', { project_id: 'my-project-id' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('EXECUTION_ERROR');
  });

  it('returns INVALID_INPUT on bad project_id', async () => {
    const result = await handleCallTool('list_gke_clusters', { project_id: 'BAD!' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe('INVALID_INPUT');
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
