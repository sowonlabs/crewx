import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// CodeCrew version - should match package.json
const CODECREW_VERSION = '0.1.8';

export interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  lastUpdated: string;
  minCodeCrewVersion?: string; // Minimum required CodeCrew version
  maxCodeCrewVersion?: string; // Maximum supported CodeCrew version
}

export interface TemplateVersions {
  latest: string;
  versions: {
    [version: string]: {
      released: string;
      templates: string[];
      description?: string;
      minCodeCrewVersion?: string;
      maxCodeCrewVersion?: string;
    };
  };
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  
  // Use current repository (sowonlabs/crewcode) for templates
  private readonly cdnBaseUrl = 'https://cdn.jsdelivr.net/gh/sowonlabs/crewcode@';
  private readonly githubRawUrl = 'https://raw.githubusercontent.com/sowonlabs/crewcode/';
  private readonly cacheDir = join(process.cwd(), '.crewx', 'cache', 'templates');

  constructor() {
    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check version compatibility
   * @param minVersion Minimum required CodeCrew version
   * @param maxVersion Maximum supported CodeCrew version
   * @returns true if compatible
   */
  private isVersionCompatible(minVersion?: string, maxVersion?: string): boolean {
    if (!minVersion && !maxVersion) {
      return true; // No version constraints
    }

    const currentVersion = CODECREW_VERSION.split('.').map(Number);
    
    if (minVersion) {
      const min = minVersion.split('.').map(Number);
      if (this.compareVersions(currentVersion, min) < 0) {
        this.logger.warn(`Template requires CodeCrew >= ${minVersion}, current version is ${CODECREW_VERSION}`);
        return false;
      }
    }

    if (maxVersion) {
      const max = maxVersion.split('.').map(Number);
      if (this.compareVersions(currentVersion, max) > 0) {
        this.logger.warn(`Template supports CodeCrew <= ${maxVersion}, current version is ${CODECREW_VERSION}`);
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
      this.logger.log(`Downloading template: ${templateName}@${version}`);
      
      // Check version compatibility from versions.json
      try {
        const versions = await this.getVersions();
        const versionInfo = versions?.versions?.[version];
        
        if (versionInfo) {
          const compatible = this.isVersionCompatible(
            versionInfo.minCodeCrewVersion,
            versionInfo.maxCodeCrewVersion
          );
          
          if (!compatible) {
            throw new Error(
              `❌ Template version ${version} is not compatible with CodeCrew ${CODECREW_VERSION}.\n` +
              `   Required: ${versionInfo.minCodeCrewVersion || 'any'} - ${versionInfo.maxCodeCrewVersion || 'any'}`
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
}
