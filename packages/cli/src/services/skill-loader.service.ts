/**
 * SkillLoaderService - Load and filter skills for agents
 * Integrates with CrewX SDK's progressive skill loading
 */

import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  parseSkillManifestFromFile,
  type SkillDefinition,
  type SkillsConfig
} from '@sowonai/crewx-sdk';

@Injectable()
export class SkillLoaderService {
  private readonly logger = new Logger(SkillLoaderService.name);

  // Default skills directories to search
  // Note: These can be customized via skills.paths in crewx.yaml
  private readonly skillsPaths = [
    join(process.cwd(), '.crewx', 'skills'),
    join(process.cwd(), 'skills'),
  ];

  /**
   * Load skills for an agent based on skills configuration
   *
   * @param skillsConfig - Skills configuration (include, exclude, autoload)
   * @returns Array of skill definitions with metadata only (progressive disclosure)
   */
  async loadAgentSkills(skillsConfig?: SkillsConfig): Promise<SkillDefinition[]> {
    if (!skillsConfig) {
      return [];
    }

    const { include, exclude, autoload } = skillsConfig;

    // If no include and autoload is false, return empty
    if (!include?.length && !autoload) {
      return [];
    }

    const skills: SkillDefinition[] = [];

    // Load included skills
    if (include?.length) {
      for (const skillName of include) {
        try {
          const skill = await this.loadSkill(skillName);
          if (skill) {
            skills.push(skill);
          }
        } catch (error) {
          this.logger.warn(`Failed to load skill "${skillName}": ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    // Apply exclusions
    if (exclude?.length) {
      return skills.filter(skill => !exclude.includes(skill.metadata.name));
    }

    return skills;
  }

  /**
   * Load a single skill by name
   *
   * @param skillName - Name of the skill to load
   * @returns Skill definition with metadata only
   */
  private async loadSkill(skillName: string): Promise<SkillDefinition | null> {
    // Try to find SKILL.md in all possible paths
    for (const basePath of this.skillsPaths) {
      const skillPath = join(basePath, skillName, 'SKILL.md');

      if (existsSync(skillPath)) {
        try {
          // Load metadata only (progressive disclosure)
          const skill = parseSkillManifestFromFile(skillPath, {
            loadContent: false, // Only load metadata
            validationMode: 'lenient'
          });

          this.logger.debug(`Loaded skill "${skillName}" from ${skillPath}`);

          return skill;
        } catch (error) {
          this.logger.warn(`Failed to parse skill at ${skillPath}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    this.logger.warn(`Skill "${skillName}" not found in paths: ${this.skillsPaths.join(', ')}`);
    return null;
  }

  /**
   * Get all available skills from skills directories
   *
   * @returns Array of all skill definitions
   */
  async listAvailableSkills(): Promise<SkillDefinition[]> {
    const skills: SkillDefinition[] = [];
    const fs = await import('fs/promises');

    for (const basePath of this.skillsPaths) {
      if (!existsSync(basePath)) {
        continue;
      }

      try {
        const entries = await fs.readdir(basePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = join(basePath, entry.name, 'SKILL.md');

            if (existsSync(skillPath)) {
              try {
                const skill = parseSkillManifestFromFile(skillPath, {
                  loadContent: false,
                  validationMode: 'lenient'
                });
                skills.push(skill);
              } catch (error) {
                this.logger.debug(`Skipping invalid skill at ${skillPath}: ${error instanceof Error ? error.message : error}`);
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to scan skills directory ${basePath}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return skills;
  }
}
