import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import glob from 'fast-glob';
import ignore from 'ignore';
import { getErrorMessage, getErrorStack } from './utils/error-utils';

export interface ProjectStructure {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: ProjectStructure[];
  extension?: string;
}

export interface ProjectAnalysis {
  structure: ProjectStructure;
  languages: string[];
  frameworks: string[];
  totalFiles: number;
  totalSize: number;
  packageInfo?: {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  language?: string;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  async analyzeProject(projectPath: string, maxDepth: number = 3): Promise<ProjectAnalysis> {
    this.logger.log(`Starting project analysis for: ${projectPath}`);

    const structure = await this.getProjectStructure(projectPath, maxDepth);
    const languages = await this.detectLanguages(projectPath);
    const frameworks = await this.detectFrameworks(projectPath);
    const packageInfo = await this.getPackageInfo(projectPath);

    const analysis: ProjectAnalysis = {
      structure,
      languages,
      frameworks,
      totalFiles: await this.countFiles(structure),
      totalSize: await this.calculateTotalSize(structure),
      packageInfo,
    };

    this.logger.log(`Project analysis completed. Found ${analysis.totalFiles} files, ${analysis.languages.length} languages`);
    return analysis;
  }

  async getProjectStructure(
    projectPath: string, 
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<ProjectStructure> {
    const stats = await fs.stat(projectPath);
    const name = path.basename(projectPath);

    if (stats.isFile()) {
      return {
        name,
        path: projectPath,
        type: 'file',
        size: stats.size,
        extension: path.extname(name).slice(1),
      };
    }

    const structure: ProjectStructure = {
      name,
      path: projectPath,
      type: 'directory',
      children: [],
    };

    if (currentDepth < maxDepth) {
      try {
        const entries = await fs.readdir(projectPath);
        const ig = await this.getIgnoreRules(projectPath);

        for (const entry of entries) {
          const entryPath = path.join(projectPath, entry);
          const relativePath = path.relative(projectPath, entryPath);

          if (!ig.ignores(relativePath) && !this.shouldIgnore(entry)) {
            try {
              const childStructure = await this.getProjectStructure(
                entryPath,
                maxDepth,
                currentDepth + 1
              );
              structure.children!.push(childStructure);
            } catch (error) {
              this.logger.warn(`Failed to process ${entryPath}: ${getErrorMessage(error)}`);
            }
          }
        }

        structure.children!.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        this.logger.warn(`Failed to read directory ${projectPath}: ${getErrorMessage(error)}`);
      }
    }

    return structure;
  }

  async searchFiles(
    projectPath: string,
    patterns: string[],
    maxFiles: number = 100
  ): Promise<string[]> {
    try {
      const ig = await this.getIgnoreRules(projectPath);
      
      const files = await glob(patterns, {
        cwd: projectPath,
        absolute: true,
        ignore: this.getDefaultIgnorePatterns(),
      });

      const filteredFiles = files
        .filter((file: any) => {
          const relativePath = path.relative(projectPath, file);
          return !ig.ignores(relativePath);
        })
        .slice(0, maxFiles);

      this.logger.log(`Found ${filteredFiles.length} files matching patterns: ${patterns.join(', ')}`);
      return filteredFiles;
    } catch (error) {
      this.logger.error(`File search failed: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  async readFileContent(filePath: string, maxSize: number = 1024 * 1024): Promise<FileContent> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size > maxSize) {
        throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath).slice(1);

      return {
        path: filePath,
        content,
        size: stats.size,
        encoding: 'utf-8',
        language: this.getLanguageFromExtension(extension),
      };
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  private async getIgnoreRules(projectPath: string): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    try {
      const gitignorePath = path.join(projectPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    } catch (error) {
      // .gitignore file doesn't exist or can't be read
    }

    // Add default ignore rules
    ig.add(this.getDefaultIgnorePatterns());
    return ig;
  }

  private getDefaultIgnorePatterns(): string[] {
    return [
      'node_modules/**',
      '.git/**',
      '.DS_Store',
      '*.log',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      '.nyc_output/**',
      '*.min.js',
      '*.min.css',
    ];
  }

  private shouldIgnore(name: string): boolean {
    const ignoreList = ['.DS_Store', 'Thumbs.db', '.git', 'node_modules'];
    return ignoreList.includes(name) || name.startsWith('.');
  }

  private async detectLanguages(projectPath: string): Promise<string[]> {
    const patterns = ['**/*.{js,ts,jsx,tsx,py,java,go,rs,cpp,c,cs,php,rb,swift,kt}'];
    const files = await glob(patterns, { cwd: projectPath });
    
    const languages = new Set<string>();
    files.forEach((file: any) => {
      const ext = path.extname(file).slice(1);
      const lang = this.getLanguageFromExtension(ext);
      if (lang) languages.add(lang);
    });

    return Array.from(languages);
  }

  private async detectFrameworks(projectPath: string): Promise<string[]> {
    const frameworks: string[] = [];

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.react || deps['@types/react']) frameworks.push('React');
      if (deps.vue || deps['@vue/cli']) frameworks.push('Vue.js');
      if (deps.angular || deps['@angular/core']) frameworks.push('Angular');
      if (deps.express) frameworks.push('Express.js');
      if (deps.fastify) frameworks.push('Fastify');
      if (deps['@nestjs/core']) frameworks.push('NestJS');
      if (deps.next) frameworks.push('Next.js');
      if (deps.nuxt) frameworks.push('Nuxt.js');
      if (deps.svelte) frameworks.push('Svelte');
    } catch (error) {
      // No package.json or failed to parse
    }

    return frameworks;
  }

  private async getPackageInfo(projectPath: string) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
      };
    } catch (error) {
      return undefined;
    }
  }

  private getLanguageFromExtension(extension: string): string | undefined {
    const languageMap: Record<string, string> = {
      js: 'JavaScript',
      jsx: 'JavaScript',
      ts: 'TypeScript',
      tsx: 'TypeScript',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      swift: 'Swift',
      kt: 'Kotlin',
    };

    return languageMap[extension.toLowerCase()];
  }

  private async countFiles(structure: ProjectStructure): Promise<number> {
    if (structure.type === 'file') return 1;
    
    if (!structure.children) return 0;
    
    let count = 0;
    for (const child of structure.children) {
      count += await this.countFiles(child);
    }
    return count;
  }

  private async calculateTotalSize(structure: ProjectStructure): Promise<number> {
    if (structure.type === 'file') return structure.size || 0;
    
    if (!structure.children) return 0;
    
    let totalSize = 0;
    for (const child of structure.children) {
      totalSize += await this.calculateTotalSize(child);
    }
    return totalSize;
  }
}