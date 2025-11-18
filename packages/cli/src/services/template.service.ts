import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { downloadTemplate } from 'giget';

// CrewX version - should match package.json
const CREWX_VERSION = '0.3.0';

// Default template repository
const DEFAULT_TEMPLATE_REPO = 'https://github.com/sowonlabs/crewx-templates';

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

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  
  // Use current repository (sowonlabs/crewx) for templates
  private readonly cdnBaseUrl = 'https://cdn.jsdelivr.net/gh/sowonlabs/crewx@';
  private readonly githubRawUrl = 'https://raw.githubusercontent.com/sowonlabs/crewx/';
  private readonly cacheDir = join(process.cwd(), '.crewx', 'cache', 'templates');
  private readonly remoteTemplatesEnabled =
    process.env.CREWX_ENABLE_REMOTE_TEMPLATES === 'true';

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
   * Parse GitHub URL to giget source format
   * @param url GitHub repository URL
   * @returns giget source string (e.g., "github:sowonlabs/crewx-templates")
   */
  private parseGitHubUrl(url: string): string {
    // Remove trailing slash if present
    const cleanUrl = url.replace(/\/$/, '');

    // Extract owner/repo from GitHub URL
    // Supports: https://github.com/owner/repo or github:owner/repo
    if (cleanUrl.startsWith('github:')) {
      return cleanUrl; // Already in giget format
    }

    const match = cleanUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${url}. Expected format: https://github.com/owner/repo`);
    }

    return `github:${match[1]}`;
  }

  /**
   * Download and scaffold a project template from Git repository
   * Uses giget (no Git CLI required) to download templates from GitHub
   *
   * @param templateName - Name of the template subdirectory (e.g., "wbs-automation")
   * @param targetDir - Target directory (usually process.cwd())
   */
  async scaffoldProject(templateName: string, targetDir: string): Promise<void> {
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

      // Download template using giget (uses GitHub tarball API, no Git CLI needed)
      await downloadTemplate(fullSource, {
        dir: targetDir,
        force: true, // Overwrite existing files
        forceClean: false, // Don't delete existing files
        offline: false,
      });

      this.logger.log(`✅ Template downloaded successfully: ${templateName}`);

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
