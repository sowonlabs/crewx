import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
/**
 * Use default import to avoid CJS/ESM named-export crash.
 * @sowonai/crewx-sdk ships as CommonJS; ESM named imports fail with:
 *   "Named export 'hashWorkspaceId' not found"
 * See: https://github.com/sowonlabs/crewx/issues/126
 */
import pkg from '@sowonai/crewx-sdk';
const { hashWorkspaceId, normalizeWorkspacePath } = pkg;
import * as path from 'path';

export interface WorkspaceContext {
  id: string;
  path: string;
  name: string;
}

declare module 'express' {
  interface Request {
    workspace?: WorkspaceContext;
  }
}

/**
 * Global middleware that resolves the current workspace from request headers
 * and attaches a `WorkspaceContext` to every request.
 *
 * Resolution order:
 * 1. `X-CrewX-Workspace` header (explicit workspace override)
 * 2. `X-CrewX-Project` header (deprecated, backward compat)
 * 3. `?project=` query param (deprecated, backward compat)
 * 4. Server `process.cwd()` (boot-time cached default)
 */
@Injectable()
export class WorkspaceMiddleware implements NestMiddleware {
  private readonly defaultWorkspace: WorkspaceContext;

  constructor() {
    const cwd = process.cwd();
    const normalized = normalizeWorkspacePath(cwd);
    this.defaultWorkspace = {
      id: hashWorkspaceId(cwd),
      path: normalized,
      name: path.basename(normalized),
    };
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const workspaceHeader = this.extractHeader(req, 'x-crewx-workspace');
    const projectHeader = this.extractHeader(req, 'x-crewx-project');
    const projectQuery = req.query['project'] as string | undefined;

    const raw = workspaceHeader || projectHeader || projectQuery;

    if (raw) {
      const normalized = normalizeWorkspacePath(raw);
      req.workspace = {
        id: hashWorkspaceId(raw),
        path: normalized,
        name: path.basename(normalized),
      };
    } else {
      req.workspace = this.defaultWorkspace;
    }

    next();
  }

  private extractHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}
