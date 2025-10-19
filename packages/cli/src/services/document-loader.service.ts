/**
 * @file DocumentLoaderService
 *
 * CRITICAL: These tests MUST pass (simple, essential functionality):
 * - tests/services/document-loader-simplified.test.ts (14 tests - inline strings)
 * - tests/services/document-loader-file-loading.test.ts (7 tests - file paths)
 * - tests/integration/cso-file-loading.test.ts (3 tests - CSO integration)
 *
 * Total: 24 essential tests that validate core document loading functionality.
 */

import { Injectable, Logger } from '@nestjs/common';
import { readFile, access } from 'fs/promises';
import { join, isAbsolute } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Heading } from 'mdast';

/**
 * DocumentLoaderService
 *
 * Loads documents from agents.yaml documents section.
 * Supports both inline strings and file paths.
 *
 * @example
 * // agents.yaml - Inline format
 * documents:
 *   my-doc: |
 *     # Title
 *     Content here
 *
 * @example
 * // agents.yaml - File path format
 * documents:
 *   crewx-docs:
 *     path: "docs/crewx.md"
 *
 * agents:
 *   - id: "my_agent"
 *     inline:
 *       system_prompt: |
 *         {{{documents.my-doc.content}}}
 */
@Injectable()
export class DocumentLoaderService {
  private readonly logger = new Logger(DocumentLoaderService.name);
  private documents: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Initialize with documents from agents.yaml
   * @param agentsYamlDocuments - documents section from agents.yaml
   * @param projectPath - base path for resolving relative file paths (optional)
   */
  async initialize(
    agentsYamlDocuments?: Record<string, string | { path: string; name?: string }>,
    projectPath?: string
  ): Promise<void> {
    // Allow re-initialization to merge documents from multiple sources
    // (e.g., built-in agents + user-defined agents)
    if (this.initialized) {
      this.logger.debug('DocumentLoaderService re-initializing to merge additional documents');
    } else {
      this.documents.clear();
    }

    if (!agentsYamlDocuments) {
      this.logger.log('No documents provided in agents.yaml');
      this.initialized = true;
      return;
    }

    // Support both inline strings and file paths
    for (const [docName, config] of Object.entries(agentsYamlDocuments)) {
      // Case 1: Inline string content (key: value | multiline)
      if (typeof config === 'string') {
        this.documents.set(docName, config);
        this.logger.debug(`Loaded inline document: ${docName} (${config.length} chars)`);
      }
      // Case 2: Object with path property
      else if (config && typeof config === 'object' && 'path' in config) {
        try {
          const content = await this.loadFileContent(config.path, projectPath);
          this.documents.set(docName, content);
          this.logger.debug(`Loaded file document: ${docName} from ${config.path} (${content.length} chars)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to load document '${docName}' from ${config.path}: ${errorMessage}`);
        }
      }
      // Case 3: Unsupported format
      else {
        this.logger.warn(`Skipping document '${docName}': unsupported format (must be string or {path: "..."})`);
      }
    }

    this.logger.log(`Loaded ${this.documents.size} documents from agents.yaml`);
    this.initialized = true;
  }

  /**
   * Load content from a file (supports both absolute and relative paths)
   */
  private async loadFileContent(filePath: string, basePath?: string): Promise<string> {
    // Use absolute path directly, or resolve relative to basePath
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : basePath
        ? join(basePath, filePath)
        : filePath;

    // Check if file exists
    await access(absolutePath);

    // Read and return content
    return await readFile(absolutePath, 'utf-8');
  }

  /**
   * Reset initialization state (for testing)
   */
  reset(): void {
    this.documents.clear();
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get document content
   */
  async getDocumentContent(docName: string): Promise<string | undefined> {
    return this.documents.get(docName);
  }

  /**
   * Get document TOC (table of contents from markdown headings)
   */
  async getDocumentToc(docName: string): Promise<string | undefined> {
    const content = this.documents.get(docName);
    if (!content) {
      return undefined;
    }

    try {
      // Parse markdown content
      const tree = unified().use(remarkParse).parse(content);

      interface TocEntry {
        depth: number;
        text: string;
      }

      const headings: TocEntry[] = [];

      // Extract headings
      visit(tree, 'heading', (node: Heading) => {
        // Convert heading children to plain text
        const text = node.children
          .map(child => {
            if (child.type === 'text') {
              return child.value;
            }
            if (child.type === 'inlineCode') {
              return child.value;
            }
            if (child.type === 'strong' && 'children' in child) {
              return child.children.map(c => (c as any).value || '').join('');
            }
            if (child.type === 'emphasis' && 'children' in child) {
              return child.children.map(c => (c as any).value || '').join('');
            }
            return '';
          })
          .join('');

        headings.push({
          depth: node.depth,
          text: text.trim()
        });
      });

      if (headings.length === 0) {
        return undefined;
      }

      // Format as markdown list
      return headings
        .map(({ depth, text }) => {
          const indent = '  '.repeat(depth - 1);
          return `${indent}- ${text}`;
        })
        .join('\n');
    } catch (error) {
      this.logger.warn(`Failed to extract TOC from document '${docName}': ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * Get document summary (not supported in simplified version)
   */
  async getDocumentSummary(_docName: string): Promise<string | undefined> {
    return undefined;
  }

  /**
   * Get all document names
   */
  getDocumentNames(): string[] {
    return Array.from(this.documents.keys());
  }
}
