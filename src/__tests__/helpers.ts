// Shared mock helpers for src/__tests__/*.test.ts.
// Pattern: each test file declares its own `vi.hoisted` mockExecFile and `vi.mock('node:child_process', ...)`,
// then imports these helpers and passes the mock fn in.
//
// Why this shape:
// - vi.mock factory bodies are hoisted before imports; they MUST reference values from vi.hoisted
//   (RESEARCH.md Pattern 1 + Pitfall referencing temporal dead zone).
// - promisify(execFile) wraps execFile's callback signature; the mock MUST call the last-arg
//   callback rather than return a Promise (RESEARCH.md Pitfall #3).
// - The mock specifier MUST be 'node:child_process' (with the node: prefix) to match
//   src/index.ts's import (RESEARCH.md Pitfall #1).
import type { Mock } from "vitest";

type ExecFileCallback = (
  error: NodeJS.ErrnoException | null,
  result: { stdout: string; stderr: string }
) => void;

/**
 * Register a one-shot success response for the next execFile invocation.
 * The mock invokes the promisify callback with `(null, { stdout, stderr: "" })`.
 */
export function mockExecSuccess(mockFn: Mock, stdout: string): void {
  mockFn.mockImplementationOnce(
    (_cmd: string, _args: string[], cb: ExecFileCallback) => {
      cb(null, { stdout, stderr: "" });
    }
  );
}

/**
 * Register a one-shot stderr-only response for the next execFile invocation.
 * runGcloud throws when stderr is non-empty AND stdout is empty — this triggers
 * the EXECUTION_ERROR path in handleCallTool's catch block.
 */
export function mockExecError(mockFn: Mock, stderr: string): void {
  mockFn.mockImplementationOnce(
    (_cmd: string, _args: string[], cb: ExecFileCallback) => {
      cb(null, { stdout: "", stderr });
    }
  );
}
