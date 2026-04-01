import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Normalize a workspace directory path for consistent hashing.
 *
 * - Resolves to an absolute path via `path.resolve`
 * - On Windows: converts backslashes to forward slashes and lowercases drive letter
 * - Strips trailing slashes (except root paths like `/` or `C:/`)
 *
 * This normalization ensures the same physical directory always produces
 * the same hash regardless of how the path was originally specified.
 */
export function normalizeWorkspacePath(workspacePath: string): string {
  let resolved = path.resolve(workspacePath);

  if (process.platform === 'win32') {
    resolved = resolved.replace(/\\/g, '/');
    resolved = resolved.replace(
      /^([A-Z]):/,
      (_match: string, drive: string) => `${drive.toLowerCase()}:`,
    );
  }

  // Strip trailing slashes, but preserve root paths like "/" or "C:/"
  if (resolved.length > 1 && !/^[a-zA-Z]:\/$/.test(resolved)) {
    resolved = resolved.replace(/\/+$/, '');
  }

  return resolved;
}

/**
 * Produce a SHA-256 hex digest (64 characters) that uniquely identifies a workspace
 * by its normalized directory path.
 *
 * @param workspacePath - Directory path (will be normalized internally)
 * @returns 64-character lowercase hex string (SHA-256)
 */
export function hashWorkspaceId(workspacePath: string): string {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  return createHash('sha256').update(normalizedPath).digest('hex');
}
