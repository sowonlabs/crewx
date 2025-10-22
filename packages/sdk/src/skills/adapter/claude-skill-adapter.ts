/**
 * Claude Skill Adapter Implementation
 * Converts Claude Code skills.md format to CrewX agent configurations
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

import { IClaudeSkillAdapter } from '../../types/skill-runtime.types';
import { 
  SkillMetadata, 
  SkillContent, 
  SkillDefinition, 
  SkillValidationResult,
  AgentDefinition 
} from '../../schema/skills.types';

/**
 * Claude Skill Adapter
 * Handles conversion between Claude skills and CrewX agents
 */
export class ClaudeSkillAdapter implements IClaudeSkillAdapter {
  
  /**
   * Extract metadata from skills.md file
   */
  async extractMetadata(skillFilePath: string): Promise<SkillMetadata> {
    try {
      const content = await fs.readFile(skillFilePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      
      if (!frontmatterMatch) {
        throw new Error('No YAML frontmatter found in skill file');
      }

      const frontmatter = yaml.load(frontmatterMatch[1] || '') as any;
      
      // Validate required fields
      if (!frontmatter.name) {
        throw new Error('Skill name is required in frontmatter');
      }
      
      if (!frontmatter.description) {
        throw new Error('Skill description is required in frontmatter');
      }
      
      if (!frontmatter.version) {
        throw new Error('Skill version is required in frontmatter');
      }

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        version: frontmatter.version,
        dependencies: frontmatter.dependencies || [],
        runtime: frontmatter.runtime || {},
        visibility: frontmatter.visibility || 'public',
        ...frontmatter // Include any additional fields
      };
      
    } catch (error) {
      throw new Error(`Failed to extract metadata from ${skillFilePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse markdown content sections
   */
  parseContent(fullContent: string): SkillContent {
    try {
      // Remove frontmatter
      const contentWithoutFrontmatter = fullContent.replace(/^---\n[\s\S]*?\n---\n/, '');
      
      // Parse sections
      const sections: SkillContent = {
        role: this.extractSection(contentWithoutFrontmatter, 'Role'),
        task: this.extractSection(contentWithoutFrontmatter, 'Task'),
        instructions: this.extractSection(contentWithoutFrontmatter, 'Instructions'),
        raw: contentWithoutFrontmatter
      };

      return sections;
      
    } catch (error) {
      throw new Error(`Failed to parse skill content: ${(error as Error).message}`);
    }
  }

  /**
   * Map Claude skill to CrewX agent configuration
   */
  mapToCrewXAgent(skill: SkillDefinition): AgentDefinition {
    const { metadata, content } = skill;
    
    // Build system prompt from content sections
    let systemPrompt = '';
    
    if (content?.role) {
      systemPrompt += `## Role\n${content.role}\n\n`;
    }
    
    if (content?.task) {
      systemPrompt += `## Task\n${content.task}\n\n`;
    }
    
    if (content?.instructions) {
      systemPrompt += `## Instructions\n${content.instructions}\n\n`;
    }

    // Create capabilities from runtime requirements
    const capabilities: string[] = [];
    
    if (metadata.runtime?.python) {
      capabilities.push(`python:${metadata.runtime.python}`);
    }
    
    if (metadata.runtime?.node) {
      capabilities.push(`node:${metadata.runtime.node}`);
    }
    
    if (metadata.runtime?.docker) {
      capabilities.push('docker');
    }

    const agent: AgentDefinition = {
      id: metadata.name,
      name: this.formatDisplayName(metadata.name),
      description: metadata.description,
      provider: 'cli/claude', // Default to Claude provider
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      inline: {
        type: 'agent',
        version: metadata.version,
        dependencies: metadata.dependencies,
        system_prompt: systemPrompt.trim() || `You are ${metadata.name}, ${metadata.description.toLowerCase()}.`
      }
    };

    return agent;
  }

  /**
   * Validate skill file format
   */
  async validateSkillFile(filePath: string): Promise<SkillValidationResult> {
    const errors = [];
    
    try {
      // Check file exists
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        errors.push({
          skillName: path.basename(filePath),
          field: 'file',
          message: 'Path is not a file',
          actual: filePath
        });
        return { valid: false, errors };
      }

      // Check file extension
      if (!filePath.endsWith('.md')) {
        errors.push({
          skillName: path.basename(filePath),
          field: 'extension',
          message: 'Skill file must have .md extension',
          actual: path.extname(filePath)
        });
      }

      // Read and validate content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for frontmatter
      if (!content.includes('---')) {
        errors.push({
          skillName: path.basename(filePath),
          field: 'frontmatter',
          message: 'Skill file must contain YAML frontmatter',
          actual: 'missing'
        });
      }

      try {
        // Validate metadata extraction
        const metadata = await this.extractMetadata(filePath);
        
        // Validate name format
        if (!/^[a-z0-9-]+$/.test(metadata.name)) {
          errors.push({
            skillName: metadata.name,
            field: 'name',
            message: 'Skill name must be kebab-case (lowercase letters, numbers, and hyphens only)',
            actual: metadata.name
          });
        }

        // Validate version format
        if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
          errors.push({
            skillName: metadata.name,
            field: 'version',
            message: 'Version must follow semantic versioning (e.g., "1.0.0")',
            actual: metadata.version
          });
        }

        // Validate description length
        if (metadata.description.length < 10) {
          errors.push({
            skillName: metadata.name,
            field: 'description',
            message: 'Description must be at least 10 characters long',
            actual: metadata.description
          });
        }

        // Validate content structure
        const parsedContent = this.parseContent(content);
        
        if (!parsedContent.role && !parsedContent.task && !parsedContent.instructions) {
          errors.push({
            skillName: metadata.name,
            field: 'content',
            message: 'Skill must have at least one of: Role, Task, or Instructions section',
            actual: 'missing sections'
          });
        }

      } catch (error) {
        errors.push({
          skillName: path.basename(filePath),
          field: 'parsing',
          message: `Failed to parse skill file: ${(error as Error).message}`,
          actual: (error as Error).message
        });
      }

    } catch (error) {
      errors.push({
        skillName: path.basename(filePath),
        field: 'file_access',
        message: `Failed to read skill file: ${(error as Error).message}`,
        actual: (error as Error).message
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Discover skills in directory
   */
  async discoverSkills(directory: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const skillFiles = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(directory, entry.name);
          
          // Quick validation - check if it looks like a skill file
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.includes('---') && content.includes('name:')) {
              skillFiles.push(filePath);
            }
          } catch {
            // Skip files that can't be read
            continue;
          }
        }
      }

      return skillFiles;
      
    } catch (error) {
      throw new Error(`Failed to discover skills in directory ${directory}: ${(error as Error).message}`);
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Extract a specific section from markdown content
   */
  private extractSection(content: string, sectionName: string): string | undefined {
    const sectionRegex = new RegExp(`^##\\s*${sectionName}\\s*$\\n([\\s\\S]*?)(?=\\n##|\\n$|$)`, 'im');
    const match = content.match(sectionRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return undefined;
  }

  /**
   * Format skill name as display name
   */
  private formatDisplayName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + (word.slice(1) || ''))
      .join(' ');
  }
}
