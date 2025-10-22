/**
 * Progressive Skill Loader Implementation
 * Implements progressive disclosure for skill loading - metadata first, content on demand
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

import fs from 'fs/promises';
import path from 'path';
import { IProgressiveSkillLoader } from '../../types/skill-runtime.types';
import { SkillMetadata, SkillDefinition } from '../../schema/skills.types';
import { ClaudeSkillAdapter } from '../adapter/claude-skill-adapter';

/**
 * Progressive Skill Loader
 * Loads skill metadata first, then full content on demand
 */
export class ProgressiveSkillLoader implements IProgressiveSkillLoader {
  private readonly claudeAdapter: ClaudeSkillAdapter;
  private readonly metadataCache: Map<string, SkillMetadata> = new Map();
  private readonly contentCache: Map<string, SkillDefinition> = new Map();
  private readonly cacheTimestamps: Map<string, number> = new Map();
  
  private readonly defaultTTL = 30 * 60 * 1000; // 30 minutes

  constructor(claudeAdapter: ClaudeSkillAdapter) {
    this.claudeAdapter = claudeAdapter;
  }

  /**
   * Load metadata only (fast path)
   */
  async loadMetadata(skillPaths: string[]): Promise<SkillMetadata[]> {
    const allMetadata: SkillMetadata[] = [];
    
    for (const skillPath of skillPaths) {
      try {
        const metadata = await this.loadMetadataFromPath(skillPath);
        allMetadata.push(...metadata);
      } catch (error) {
        console.warn(`Failed to load metadata from ${skillPath}:`, error);
      }
    }
    
    // Remove duplicates (by skill name)
    const uniqueMetadata = this.deduplicateMetadata(allMetadata);
    
    // Cache the results
    for (const metadata of uniqueMetadata) {
      this.metadataCache.set(metadata.name, metadata);
      this.cacheTimestamps.set(`metadata:${metadata.name}`, Date.now());
    }
    
    return uniqueMetadata;
  }

  /**
   * Load full content for specific skill
   */
  async loadFullContent(skillName: string): Promise<SkillDefinition> {
    // Check cache first
    const cached = this.contentCache.get(skillName);
    if (cached && !this.isCacheExpired(`content:${skillName}`)) {
      return cached;
    }

    // Find skill file from cached metadata
    const metadata = this.metadataCache.get(skillName);
    if (!metadata) {
      throw new Error(`Skill "${skillName}" not found. Load metadata first.`);
    }

    // Try to find the actual skill file
    const skillFilePath = await this.findSkillFile(skillName);
    if (!skillFilePath) {
      throw new Error(`Skill file for "${skillName}" not found`);
    }

    try {
      // Read full content
      const fullContent = await fs.readFile(skillFilePath, 'utf-8');
      
      // Parse content sections
      const content = this.claudeAdapter.parseContent(fullContent);
      
      const definition: SkillDefinition = {
        metadata,
        content,
        filePath: skillFilePath,
        fullyLoaded: true
      };

      // Cache the result
      this.contentCache.set(skillName, definition);
      this.cacheTimestamps.set(`content:${skillName}`, Date.now());

      return definition;
      
    } catch (error) {
      throw new Error(`Failed to load full content for skill "${skillName}": ${(error as Error).message}`);
    }
  }

  /**
   * Check if skill has full content loaded
   */
  isFullyLoaded(skillName: string): boolean {
    const cached = this.contentCache.get(skillName);
    return cached?.fullyLoaded || false;
  }

  /**
   * Preload content for skills
   */
  async preloadContent(skillNames: string[]): Promise<void> {
    const loadPromises = skillNames.map(skillName => 
      this.loadFullContent(skillName).catch(error => {
        console.warn(`Failed to preload content for skill "${skillName}":`, error);
        return null;
      })
    );

    await Promise.all(loadPromises);
  }

  /**
   * Clear cached content
   */
  async clearContentCache(): Promise<void> {
    this.contentCache.clear();
    
    // Clear content timestamps
    const keysToDelete: string[] = [];
    for (const [key] of this.cacheTimestamps) {
      if (key.startsWith('content:')) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cacheTimestamps.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      metadataCache: this.metadataCache.size,
      contentCache: this.contentCache.size,
      totalItems: this.metadataCache.size + this.contentCache.size
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.metadataCache.clear();
    this.contentCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > this.defaultTTL) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cacheTimestamps.delete(key);
      
      if (key.startsWith('metadata:')) {
        const skillName = key.replace('metadata:', '');
        this.metadataCache.delete(skillName);
      } else if (key.startsWith('content:')) {
        const skillName = key.replace('content:', '');
        this.contentCache.delete(skillName);
      }
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Load metadata from a specific path
   */
  private async loadMetadataFromPath(skillPath: string): Promise<SkillMetadata[]> {
    const metadata: SkillMetadata[] = [];

    try {
      const stats = await fs.stat(skillPath);
      
      if (stats.isFile() && skillPath.endsWith('.md')) {
        // Single skill file
        const skillMetadata = await this.claudeAdapter.extractMetadata(skillPath);
        metadata.push(skillMetadata);
        
      } else if (stats.isDirectory()) {
        // Directory containing skill files
        const skillFiles = await this.claudeAdapter.discoverSkills(skillPath);
        
        for (const filePath of skillFiles) {
          try {
            const skillMetadata = await this.claudeAdapter.extractMetadata(filePath);
            metadata.push(skillMetadata);
          } catch (error) {
            console.warn(`Failed to load metadata from ${filePath}:`, error);
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to load metadata from path ${skillPath}: ${(error as Error).message}`);
    }

    return metadata;
  }

  /**
   * Remove duplicate metadata entries
   */
  private deduplicateMetadata(metadata: SkillMetadata[]): SkillMetadata[] {
    const seen = new Set<string>();
    const unique: SkillMetadata[] = [];

    for (const item of metadata) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Find skill file by name
   */
  private async findSkillFile(skillName: string): Promise<string | null> {
    const metadata = this.metadataCache.get(skillName);
    if (!metadata) {
      return null;
    }

    // Try to reconstruct the file path
    // This is a simplified approach - in practice, we'd store the original path
    const possiblePaths = [
      `./skills/${skillName}.md`,
      `~/.claude/skills/${skillName}.md`,
      `./${skillName}.md`
    ];

    for (const possiblePath of possiblePaths) {
      try {
        const expandedPath = possiblePath.replace('~', process.env.HOME || '');
        await fs.access(expandedPath);
        return expandedPath;
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      return true;
    }

    return Date.now() - timestamp > this.defaultTTL;
  }
}