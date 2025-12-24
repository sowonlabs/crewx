import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parseSkillManifestFromFile } from '@sowonai/crewx-sdk';
import { spawn } from 'child_process';

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  entryPoint: string;
  path: string;
}

@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);
  private skillsDirs: string[];

  constructor() {
    this.skillsDirs = [
      path.join(process.cwd(), 'skills'),
      path.join(process.cwd(), '.crewx', 'skills')
    ];
  }

  async discover(): Promise<SkillMetadata[]> {
    const skills: SkillMetadata[] = [];
    
    for (const dirPath of this.skillsDirs) {
        if (!fs.existsSync(dirPath)) continue;

        try {
            const dirs = fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(d => d.isDirectory());

            for (const dir of dirs) {
                const skillPath = path.join(dirPath, dir.name);
                const skillMdPath = path.join(skillPath, 'SKILL.md');

                if (fs.existsSync(skillMdPath)) {
                    try {
                        // Use SDK to parse frontmatter
                        const manifest = parseSkillManifestFromFile(skillMdPath, {
                            loadContent: false,
                            validationMode: 'lenient'
                        });
                        
                        const entryPoint = this.detectEntryPoint(skillPath, dir.name);

                        if (entryPoint) {
                            skills.push({
                                name: manifest.metadata.name || dir.name,
                                description: manifest.metadata.description || '',
                                version: manifest.metadata.version || '0.0.0',
                                entryPoint,
                                path: skillPath,
                            });
                        }
                    } catch (e) {
                        this.logger.debug(`Failed to parse SKILL.md in ${skillPath}: ${e}`);
                    }
                }
            }
        } catch (e) {
            this.logger.warn(`Failed to read skills directory ${dirPath}: ${e}`);
        }
    }
    return skills;
  }

  async getSkill(name: string): Promise<SkillMetadata | null> {
    const skills = await this.discover();
    return skills.find(s => s.name === name) || null;
  }

  private detectEntryPoint(skillPath: string, skillName: string): string | null {
    const candidates = [
      `${skillName}.js`,
      `${skillName}.sh`,
      `${skillName}.py`,
      'index.js',
      'main.js',
    ];

    for (const candidate of candidates) {
      const fullPath = path.join(skillPath, candidate);
      if (fs.existsSync(fullPath)) {
        return candidate;
      }
    }

    return null;
  }

  async execute(name: string, args: string[]): Promise<{ code: number; output: string }> {
    const skill = await this.getSkill(name);
    if (!skill) {
        throw new Error(`Skill '${name}' not found`);
    }

    const entryPath = path.join(skill.path, skill.entryPoint);
    
    return new Promise((resolve, reject) => {
        let command: string;
        let cmdArgs: string[];

        if (skill.entryPoint.endsWith('.js')) {
            command = 'node';
            cmdArgs = [entryPath, ...args];
        } else if (skill.entryPoint.endsWith('.sh')) {
            command = 'sh';
            cmdArgs = [entryPath, ...args];
        } else if (skill.entryPoint.endsWith('.py')) {
            command = 'python3';
            cmdArgs = [entryPath, ...args];
        } else {
             reject(new Error(`Unsupported entry point: ${skill.entryPoint}`));
             return;
        }

        const child = spawn(command, cmdArgs, {
            cwd: skill.path,
            stdio: 'inherit' 
        });

        child.on('close', (code) => {
            resolve({ code: code || 0, output: '' });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
  }
}
