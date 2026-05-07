---
phase: "02"
plan: "01"
subsystem: "test-infrastructure"
tags: [vitest, coverage, refactor, test-helpers]
dependency_graph:
  requires: []
  provides:
    - "vitest 4.1.5 test runner installed and configured"
    - "handleCallTool named export for test isolation"
    - "src/__tests__/helpers.ts shared mock helpers"
  affects:
    - "src/index.ts (handleCallTool export, NODE_ENV guard)"
    - "package.json (test scripts, devDependencies)"
    - "vitest.config.ts (new file)"
    - "src/__tests__/helpers.ts (new file)"
tech_stack:
  added:
    - "vitest@4.1.5"
    - "@vitest/coverage-v8@4.1.5"
  patterns:
    - "vi.hoisted + vi.mock callback-form mock pattern for node:child_process"
    - "extracted named export + NODE_ENV guard for test-safe module import"
key_files:
  created:
    - "vitest.config.ts"
    - "src/__tests__/helpers.ts"
  modified:
    - "package.json"
    - "src/index.ts"
decisions:
  - "Extracted handleCallTool as named export (RESEARCH A2 recommendation) rather than NODE_ENV-only guard approach — cleaner test surface"
  - "Added both NODE_ENV guard AND named export as defense-in-depth (plan spec)"
  - "helpers.ts uses Mock from vitest (not ReturnType<typeof vi.fn>) per plan instruction"
  - "vi.mock comment in helpers.ts is documentation only; no actual vi.mock call in the file"
metrics:
  duration: "4m14s"
  completed: "2026-05-07"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 02 Plan 01: Test Infrastructure Setup Summary

**One-liner:** Vitest 4.1.5 installed with v8 coverage and 80% thresholds; handleCallTool exported from src/index.ts with NODE_ENV guard; shared mock helpers using callback-form vi.hoisted pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install Vitest, add test script, create vitest.config.ts | 818cfb7 | package.json, package-lock.json, vitest.config.ts |
| 2 | Extract handleCallTool as named export from src/index.ts | fc60876 | src/index.ts |
| 3 | Create src/__tests__/helpers.ts with vi.hoisted mock pattern | 1d497d4 | src/__tests__/helpers.ts |

## What Was Built

### Task 1: Vitest Infrastructure

- Installed `vitest@4.1.5` and `@vitest/coverage-v8@4.1.5` as devDependencies
- Added `"test": "vitest run --coverage"` and `"test:watch": "vitest"` to package.json scripts
- Created `vitest.config.ts` with:
  - `environment: 'node'`
  - `include: ['src/__tests__/**/*.test.ts']`
  - v8 coverage provider scoped to `src/index.ts`
  - 80% thresholds for lines, functions, branches, statements

### Task 2: handleCallTool Export Refactor

Extracted the entire `server.setRequestHandler(CallToolRequestSchema, ...)` body into a standalone exported function `handleCallTool(name, args)`. The setRequestHandler is now a thin one-liner delegating to that function. Added `if (process.env.NODE_ENV !== "test")` guard around `server.connect(transport)` as defense-in-depth against test process hang.

All 18 case blocks moved verbatim — no logic changes. `npx tsc --noEmit` and `npm run build` pass with zero errors.

### Task 3: Shared Mock Helpers

Created `src/__tests__/helpers.ts` with:
- `mockExecSuccess(mockFn: Mock, stdout: string): void` — registers a one-shot success via `mockImplementationOnce` calling the promisify callback `cb(null, { stdout, stderr: "" })`
- `mockExecError(mockFn: Mock, stderr: string): void` — registers a one-shot stderr-only response triggering `runGcloud`'s throw path

Key design decisions per RESEARCH.md:
- Uses callback form (`mockImplementationOnce` with `cb(null, ...)`) not `mockResolvedValueOnce` — required because `promisify(execFile)` wraps the callback, not the return value
- Does NOT call `vi.mock` itself — that must be top-level in each test file (hoisting constraint)
- Uses `Mock` type from vitest (not `any`, not `ReturnType<typeof vi.fn>`)
- Defines explicit `ExecFileCallback` type with `NodeJS.ErrnoException | null` error parameter

## Verification Results

All 6 post-completion verifications passed:

1. `npx tsc --noEmit` — zero errors
2. `npm run build` — zero errors, dist/index.js regenerated
3. `npx vitest --version` — 4.1.5
4. `npx vitest run` — exits 0 (no test files yet — Wave 1 fills them in)
5. `grep "^export async function handleCallTool"` — matches line 286
6. `grep 'if (process.env.NODE_ENV !== "test")'` — matches line 576

## Deviations from Plan

None — plan executed exactly as written.

The `vi.mock(` occurrence in helpers.ts line 2 is in a code comment (documentation of the per-file pattern), not an actual call. The acceptance criterion was interpreted as "no actual `vi.mock` invocation" — the comment is intentional documentation.

## Known Stubs

None. This plan creates infrastructure only (no data rendering, no UI components). Wave 1 plans will add actual test files.

## Threat Flags

None. This plan adds devDependency tooling and a test-helper file. No new network endpoints, auth paths, or production code surface area was introduced beyond the `handleCallTool` export (which is a refactor of existing logic, not new attack surface).

## Self-Check: PASSED

Files verified:
- vitest.config.ts: EXISTS
- src/__tests__/helpers.ts: EXISTS
- package.json: contains "vitest run --coverage"
- src/index.ts: contains export async function handleCallTool (line 286)

Commits verified:
- 818cfb7: chore(02-01): install vitest 4.1.5 and create vitest.config.ts
- fc60876: refactor(02-01): extract handleCallTool as named export from src/index.ts
- 1d497d4: feat(02-01): create src/__tests__/helpers.ts with vi.hoisted mock pattern
