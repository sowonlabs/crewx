import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { downloadTemplate } from 'giget';

// CrewX version - should match package.json
const CREWX_VERSION = '0.3.0';

// Default template repository
const DEFAULT_TEMPLATE_REPO = 'https://github.com/sowonlabs/crewx-templates';
const TEMPLATE_LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  lastUpdated: string;
  minCrewxVersion?: string; // Minimum required CrewX version
  maxCrewxVersion?: string; // Maximum supported CrewX version
}

export interface TemplateVersions {
  latest: string;
  versions: {
    [version: string]: {
      released: string;
      templates: string[];
      description?: string;
      minCrewxVersion?: string;
      maxCrewxVersion?: string;
    };
  };
}

export interface TemplateListItem {
  id: string;
  displayName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  repo?: string;
  path?: string;
  readme?: string;
}

interface TemplateRegistry {
  version?: string;
  templates?: TemplateListItem[];
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  
  // Use current repository (sowonlabs/crewx) for templates
  private readonly cdnBaseUrl = 'https://cdn.jsdelivr.net/gh/sowonlabs/crewx@';
  private readonly githubRawUrl = 'https://raw.githubusercontent.com/sowonlabs/crewx/';
  private readonly cacheDir = join(process.cwd(), '.crewx', 'cache', 'templates');
  private readonly remoteTemplatesEnabled =
    process.env.CREWX_ENABLE_REMOTE_TEMPLATES === 'true';
  private templateListCache: {
    repo: string;
    expiresAt: number;
    templates: TemplateListItem[];
  } | null = null;

  constructor() {
    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Attempt to load a template from the local filesystem before hitting the network.
   * This lets developers verify template changes without publishing to CDN/GitHub,
   * and also allows packaged installs to reuse bundled templates.
   */
  private tryLoadLocalTemplate(templateName: string): string | undefined {
    const candidatePaths = [
      join(__dirname, '..', 'templates', 'agents', `${templateName}.yaml`),
      join(__dirname, '..', '..', 'templates', 'agents', `${templateName}.yaml`),
      join(__dirname, '..', '..', '..', 'templates', 'agents', `${templateName}.yaml`),
      join(process.cwd(), 'templates', 'agents', `${templateName}.yaml`),
    ];

    for (const candidate of candidatePaths) {
      if (!existsSync(candidate)) {
        continue;
      }

      try {
        const content = readFileSync(candidate, 'utf8');
        this.logger.log(`📄 Using local template: ${templateName} (${candidate})`);
        return content;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to read local template at ${candidate}: ${message}`);
      }
    }

    return undefined;
  }

  /**
   * Check version compatibility
   * @param minVersion Minimum required CrewX version
   * @param maxVersion Maximum supported CrewX version
   * @returns true if compatible
   */
  private isVersionCompatible(minVersion?: string, maxVersion?: string): boolean {
    if (!minVersion && !maxVersion) {
      return true; // No version constraints
    }

    const currentVersion = CREWX_VERSION.split('.').map(Number);
    
    if (minVersion) {
      const min = minVersion.split('.').map(Number);
      if (this.compareVersions(currentVersion, min) < 0) {
        this.logger.warn(`Template requires CrewX >= ${minVersion}, current version is ${CREWX_VERSION}`);
        return false;
      }
    }

    if (maxVersion) {
      const max = maxVersion.split('.').map(Number);
      if (this.compareVersions(currentVersion, max) > 0) {
        this.logger.warn(`Template supports CrewX <= ${maxVersion}, current version is ${CREWX_VERSION}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Compare two version arrays
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: number[], v2: number[]): number {
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }
    return 0;
  }

  /**
   * Download template from GitHub (via jsDelivr CDN) with version compatibility check
   */
  async downloadTemplate(
    templateName: string,
    version: string = 'main'
  ): Promise<string> {
    try {
      // Prefer local templates when available (developer builds or packaged assets)
      const localTemplate = this.tryLoadLocalTemplate(templateName);
      if (localTemplate) {
        return localTemplate;
      }

      if (!this.remoteTemplatesEnabled) {
        this.logger.warn(
          `Remote template download disabled (set CREWX_ENABLE_REMOTE_TEMPLATES=true to enable).`
        );

        const cached = this.loadFromCache(templateName, version);
        if (cached) {
          this.logger.log(`📦 Using cached template: ${templateName}@${version}`);
          return cached;
        }

        throw new Error(
          `Remote template download disabled and no cached template found for ${templateName}@${version}`
        );
      }

      this.logger.log(`Downloading template: ${templateName}@${version}`);

      // Check version compatibility from versions.json
      try {
        const versions = await this.getVersions();
        const versionInfo = versions?.versions?.[version];

        if (versionInfo) {
          const compatible = this.isVersionCompatible(
            versionInfo.minCrewxVersion,
            versionInfo.maxCrewxVersion
          );

          if (!compatible) {
            throw new Error(
              `❌ Template version ${version} is not compatible with CrewX ${CREWX_VERSION}.\n` +
              `   Required: ${versionInfo.minCrewxVersion || 'any'} - ${versionInfo.maxCrewxVersion || 'any'}`
            );
          }
        }
      } catch (versionError: any) {
        this.logger.warn(`Could not check version compatibility: ${versionError?.message || versionError}`);
        // Continue anyway if version check fails
      }

      // Try CDN first (faster, cached)
      const cdnUrl = `${this.cdnBaseUrl}${version}/templates/agents/${templateName}.yaml`;

      try {
        const response = await fetch(cdnUrl);
        if (response.ok) {
          const content = await response.text();
          this.logger.log(`✅ Downloaded from CDN: ${templateName}@${version}`);

          // Cache the template locally
          this.cacheTemplate(templateName, version, content);

          return content;
        }
      } catch (cdnError) {
        this.logger.warn(`CDN download failed, trying GitHub raw...`);
      }

      // Fallback to GitHub raw URL
      const githubUrl = `${this.githubRawUrl}${version}/templates/agents/${templateName}.yaml`;
      const response = await fetch(githubUrl);

      if (!response.ok) {
        throw new Error(`Template not found: ${templateName}@${version} (HTTP ${response.status})`);
      }

      const content = await response.text();
      this.logger.log(`✅ Downloaded from GitHub: ${templateName}@${version}`);

      // Cache the template
      this.cacheTemplate(templateName, version, content);

      return content;
      
    } catch (error) {
      this.logger.error(`Failed to download template: ${error instanceof Error ? error.message : error}`);
      
      // Try to load from cache
      const cached = this.loadFromCache(templateName, version);
      if (cached) {
        this.logger.log(`📦 Using cached template: ${templateName}@${version}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Fetch templates.json from the configured repository with caching.
   */
  async fetchTemplateList(): Promise<TemplateListItem[]> {
    const repo = process.env.CREWX_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO;

    if (
      this.templateListCache &&
      this.templateListCache.repo === repo &&
      this.templateListCache.expiresAt > Date.now()
    ) {
      return this.templateListCache.templates;
    }

    try {
      const registryUrl = this.buildTemplatesRegistryUrl(repo);
      const response = await fetch(registryUrl);

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch templates.json from ${registryUrl} (HTTP ${response.status}). Returning empty list.`
        );
        return [];
      }

      const registry: TemplateRegistry = await response.json();
      const templates = Array.isArray(registry?.templates) ? registry.templates : [];

      this.templateListCache = {
        repo,
        expiresAt: Date.now() + TEMPLATE_LIST_CACHE_TTL_MS,
        templates,
      };

      return templates;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch template list: ${error instanceof Error ? error.message : error}. Returning empty list.`
      );
      return [];
    }
  }

  /**
   * Get available templates list
   */
  async listAvailableTemplates(version: string = 'main'): Promise<string[]> {
    if (!this.remoteTemplatesEnabled) {
      this.logger.warn(
        'Remote template listing disabled (set CREWX_ENABLE_REMOTE_TEMPLATES=true to enable). Returning defaults.'
      );
      return ['default', 'minimal', 'development', 'production'];
    }

    try {
      const url = `${this.cdnBaseUrl}${version}/versions.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template list (HTTP ${response.status})`);
      }
      
      const data: TemplateVersions = await response.json();
      const latestVersion = data.latest;
      const templates = data.versions[latestVersion]?.templates || [];
      
      return templates;
    } catch (error) {
      this.logger.error(`Failed to list templates: ${error instanceof Error ? error.message : error}`);
      
      // Return default templates as fallback
      return ['default', 'minimal', 'development', 'production'];
    }
  }

  /**
   * Get template versions information
   */
  async getVersions(): Promise<TemplateVersions | null> {
    if (!this.remoteTemplatesEnabled) {
      this.logger.warn(
        'Remote template version lookup disabled (set CREWX_ENABLE_REMOTE_TEMPLATES=true to enable).'
      );
      return null;
    }

    try {
      const url = `${this.cdnBaseUrl}main/versions.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get versions: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Check if template repository is accessible
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const url = `${this.cdnBaseUrl}main/versions.json`;
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cache template locally
   */
  private cacheTemplate(name: string, version: string, content: string): void {
    try {
      const cacheFile = join(this.cacheDir, `${name}_${version}.yaml`);
      writeFileSync(cacheFile, content, 'utf8');
      this.logger.log(`💾 Cached template: ${name}@${version}`);
    } catch (error) {
      this.logger.warn(`Failed to cache template: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Load template from local cache
   */
  private loadFromCache(name: string, version: string): string | null {
    try {
      const cacheFile = join(this.cacheDir, `${name}_${version}.yaml`);
      
      if (existsSync(cacheFile)) {
        return readFileSync(cacheFile, 'utf8');
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to load from cache: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.yaml')) {
          fs.unlinkSync(join(this.cacheDir, file));
        }
      }

      this.logger.log('🧹 Template cache cleared');
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Resolve GitHub repository components (owner/repo/ref)
   */
  private getTemplateRepositoryInfo(repoUrl: string): { owner: string; name: string; ref: string } {
    const defaultRef = 'main';
    const normalizeRepoName = (name: string) => name.replace(/\.git$/, '');

    if (repoUrl.startsWith('github:')) {
      const withoutPrefix = repoUrl.replace(/^github:/, '');
      const [repoPath, ref] = withoutPrefix.split('#');
      if (!repoPath) {
        throw new Error(`Invalid GitHub repository: ${repoUrl}`);
      }

      const [owner, repo] = repoPath.split('/');
      if (!owner || !repo) {
        throw new Error(`Invalid GitHub repository: ${repoUrl}`);
      }

      return { owner, name: normalizeRepoName(repo), ref: ref || defaultRef };
    }

    try {
      const parsed = new URL(repoUrl);
      if (!parsed.hostname.includes('github.com')) {
        throw new Error(`Repository must be hosted on GitHub: ${repoUrl}`);
      }

      const trimmedPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
      const segments = trimmedPath.split('/');
      const owner = segments[0];
      const repo = segments[1];

      if (!owner || !repo) {
        throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
      }

      let ref = defaultRef;
      if (segments.length >= 4 && segments[2] === 'tree' && segments[3]) {
        ref = segments[3];
      }

      if (parsed.hash) {
        ref = parsed.hash.substring(1);
      }

      return { owner, name: normalizeRepoName(repo), ref: ref || defaultRef };
    } catch (error) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
  }

  private buildTemplatesRegistryUrl(repoUrl: string): string {
    const { owner, name, ref } = this.getTemplateRepositoryInfo(repoUrl);
    return `https://raw.githubusercontent.com/${owner}/${name}/${ref}/templates.json`;
  }

  /**
   * Parse GitHub URL to giget source format
   * @param url GitHub repository URL
   * @returns giget source string (e.g., "github:sowonlabs/crewx-templates")
   */
  private parseGitHubUrl(url: string): string {
    if (url.startsWith('github:')) {
      return url;
    }

    const { owner, name, ref } = this.getTemplateRepositoryInfo(url);
    const suffix = ref && ref !== 'main' ? `#${ref}` : '';
    return `github:${owner}/${name}${suffix}`;
  }

  /**
   * Recursively collect all file paths in a directory
   */
  private collectFiles(dir: string, baseDir: string = dir): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.collectFiles(fullPath, baseDir));
      } else {
        // Get relative path from base directory
        const relativePath = fullPath.substring(baseDir.length + 1);
        files.push(relativePath);
      }
    }

    return files;
  }

  /**
   * Download and scaffold a project template from Git repository
   * Uses giget (no Git CLI required) to download templates from GitHub
   *
   * @param templateName - Name of the template subdirectory (e.g., "wbs-automation")
   * @param targetDir - Target directory (usually process.cwd())
   * @param force - Force overwrite existing files (default: false)
   * @returns Object containing created and skipped file counts
   */
  async scaffoldProject(
    templateName: string,
    targetDir: string,
    force: boolean = false
  ): Promise<{ created: number; skipped: number; createdFiles: string[]; skippedFiles: string[] }> {
    try {
      // Get repository from environment variable or use default
      const repo = process.env.CREWX_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO;
      this.logger.log(`📦 Downloading template from: ${repo}`);

      // Parse GitHub URL to giget source format
      const source = this.parseGitHubUrl(repo);

      // Construct full source path with template subdirectory
      // Format: github:owner/repo/subdir#branch
      const fullSource = `${source}/${templateName}`;

      this.logger.log(`📥 Downloading: ${templateName}`);
      this.logger.log(`🎯 Target directory: ${targetDir}`);

      // Create a temporary directory for download
      const tempDir = join(targetDir, '.crewx-temp-download');

      // Download template to temporary directory first
      await downloadTemplate(fullSource, {
        dir: tempDir,
        force: true, // Always overwrite in temp directory
        forceClean: false,
        offline: false,
      });

      // Track file creation statistics
      let createdCount = 0;
      let skippedCount = 0;
      const createdFiles: string[] = [];
      const skippedFiles: string[] = [];

      // Get all files from temporary directory
      const templateFiles = this.collectFiles(tempDir);

      // Copy files from temp to target, respecting force flag
      for (const relativeFile of templateFiles) {
        const sourceFile = join(tempDir, relativeFile);
        const targetFile = join(targetDir, relativeFile);

        // Check if file exists in target directory
        const fileExists = existsSync(targetFile);

        if (fileExists && !force) {
          // Skip existing file
          this.logger.log(`⚠️  Skipping existing file: ${relativeFile}`);
          skippedCount++;
          skippedFiles.push(relativeFile);
        } else {
          // Create target directory if needed
          const targetFileDir = join(targetFile, '..');
          if (!existsSync(targetFileDir)) {
            mkdirSync(targetFileDir, { recursive: true });
          }

          // Copy file from temp to target
          const content = readFileSync(sourceFile, 'utf8');
          writeFileSync(targetFile, content, 'utf8');

          if (fileExists) {
            this.logger.log(`✅ Overwritten: ${relativeFile}`);
          } else {
            this.logger.log(`✅ Created: ${relativeFile}`);
          }

          createdCount++;
          createdFiles.push(relativeFile);
        }
      }

      // Clean up temporary directory
      const fs = require('fs');
      fs.rmSync(tempDir, { recursive: true, force: true });

      this.logger.log(`✅ Template processing complete: ${templateName}`);

      return {
        created: createdCount,
        skipped: skippedCount,
        createdFiles,
        skippedFiles,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to download template: ${message}`);

      // Provide helpful error messages
      if (message.includes('404') || message.includes('Not Found')) {
        throw new Error(
          `Template "${templateName}" not found in repository.\n` +
          `  Repository: ${process.env.CREWX_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO}\n` +
          `  Template: ${templateName}\n\n` +
          `Please check:\n` +
          `  1. Template name is correct\n` +
          `  2. Repository URL is correct (use CREWX_TEMPLATE_REPO env variable)\n` +
          `  3. Repository is publicly accessible`
        );
      }

      if (message.includes('network') || message.includes('ENOTFOUND')) {
        throw new Error(
          `Network error while downloading template.\n` +
          `  Repository: ${process.env.CREWX_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO}\n\n` +
          `Please check your internet connection and try again.`
        );
      }

      throw new Error(`Failed to download template: ${message}`);
    }
  }
}
