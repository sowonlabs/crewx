/**
 * Tool execution context providing access to workspace, file system, and agent information
 */
export interface ToolExecutionContext {
  // Workspace
  workingDirectory: string;
  isPathWithinWorkspace(path: string): boolean;

  // File system
  fileSystemService: FileSystemService;
  shouldIgnoreFile(path: string): boolean;

  // Agent info
  agentId: string;
  provider: string;
  model: string;

  // Environment variables
  env: Record<string, string | undefined>;

  // User-defined variables
  vars: Record<string, any>;
}

/**
 * File system service abstraction
 */
export interface FileSystemService {
  readFile(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number; isDirectory: boolean }>;
  readdir(path: string): Promise<string[]>;
}

/**
 * Result of processing a file read operation
 */
export interface ProcessedFileReadResult {
  llmContent: string | { inlineData: { data: string; mimeType: string } };
  returnDisplay: string;
  error?: string;
  errorType?: ToolErrorType;
  isTruncated?: boolean;
  originalLineCount?: number;
  linesShown?: [number, number];
}

/**
 * Tool error types
 */
export enum ToolErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PATH_IS_DIRECTORY = 'PATH_IS_DIRECTORY',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  BINARY_FILE = 'BINARY_FILE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN',
}
