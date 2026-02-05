import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parseSkillManifestFromFile } from '@sowonai/crewx-sdk';
import { spawn, execSync } from 'child_process';
import { TracingService, SpanKind } from './tracing.service';

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  entryPoint: string | null;
  path: string;
  source?: 'custom' | 'installed' | 'template';
}

export interface RegistryEntry {
  source: 'npm' | 'template' | 'github';
  package?: string;
  template?: string;
  version: string;
  installed: string;
}

export interface SkillRegistry {
  skills: Record<string, RegistryEntry>;
}

export type SkillSource =
  | { type: 'npm'; package: string }
  | { type: 'template'; name: string }
  | { type: 'github'; repo: string; version?: string };

@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);
  private skillsDirs: string[];
  private installedSkillsDir: string;
  private crewxDir: string;
  private registryPath: string;
  private tracingService: TracingService | null = null;

  constructor() {
    this.crewxDir = path.join(process.cwd(), '.crewx');
    this.installedSkillsDir = path.join(this.crewxDir, 'skills');
    this.registryPath = path.join(this.crewxDir, 'registry.json');

    // Priority: custom skills > installed skills
    this.skillsDirs = [
      path.join(process.cwd(), 'skills'),
      this.installedSkillsDir
    ];

    // Initialize TracingService for span tracking (Phase 3c)
    this.initTracing();
  }

  /**
   * Initialize TracingService lazily to avoid circular dependencies
   */
  private initTracing(): void {
    try {
      this.tracingService = new TracingService();
      // Manually call onModuleInit since we're not using DI
      this.tracingService.onModuleInit();
    } catch (error) {
      this.logger.warn(`Failed to initialize TracingService for skill tracking: ${error}`);
      this.tracingService = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Management
  // ─────────────────────────────────────────────────────────────────────────

  private loadRegistry(): SkillRegistry {
    try {
      if (fs.existsSync(this.registryPath)) {
        const content = fs.readFileSync(this.registryPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      this.logger.warn(`Failed to load registry: ${e}`);
    }
    return { skills: {} };
  }

  private saveRegistry(registry: SkillRegistry): void {
    this.ensureCrewxDir();
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
  }

  private ensureCrewxDir(): void {
    if (!fs.existsSync(this.crewxDir)) {
      fs.mkdirSync(this.crewxDir, { recursive: true });
    }
  }

  private ensureInstalledSkillsDir(): void {
    this.ensureCrewxDir();
    if (!fs.existsSync(this.installedSkillsDir)) {
      fs.mkdirSync(this.installedSkillsDir, { recursive: true });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Source Parsing
  // ─────────────────────────────────────────────────────────────────────────

  parseSource(source: string): SkillSource | null {
    // npm:<package> - e.g., npm:@crewx/memory, npm:crewx-skill-memory
    if (source.startsWith('npm:')) {
      return { type: 'npm', package: source.slice(4) };
    }
    // template:<name> - e.g., template:memory, template:hello
    if (source.startsWith('template:')) {
      return { type: 'template', name: source.slice(9) };
    }
    // github:<owner/repo>[@version] - Phase 1.5
    if (source.startsWith('github:')) {
      const rest = source.slice(7);
      const atIndex = rest.lastIndexOf('@');
      if (atIndex > 0 && !rest.slice(0, atIndex).includes('/')) {
        // Invalid format
        return null;
      }
      if (atIndex > 0) {
        return { type: 'github', repo: rest.slice(0, atIndex), version: rest.slice(atIndex + 1) };
      }
      return { type: 'github', repo: rest };
    }
    return null;
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

                        // Guide mode: include skills without entryPoint (document-only skills)
                        skills.push({
                            name: manifest.metadata.name || dir.name,
                            description: manifest.metadata.description || '',
                            version: manifest.metadata.version || '0.0.0',
                            entryPoint: entryPoint || null,
                            path: skillPath,
                        });
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

    // Guide mode: if no entryPoint, output SKILL.md content
    if (!skill.entryPoint) {
      const skillMdPath = path.join(skill.path, 'SKILL.md');
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      console.log(content);
      return { code: 0, output: content };
    }

    const entryPoint = skill.entryPoint!;  // Already checked for null above
    const entryPath = path.join(skill.path, entryPoint);

    // Phase 3c: Get task_id from environment variable for span tracking
    // Issue #84: Skip span creation if CLI handler already created one
    const taskId = process.env.CREWX_TASK_ID;
    const spanAlreadyCreated = process.env.CREWX_SKILL_SPAN_CREATED === 'true';
    let spanId: string | null = null;
    const startTime = Date.now();

    // Create span if we have a task_id, tracing is enabled, and no span was created by CLI handler
    if (taskId && this.tracingService?.isEnabled() && !spanAlreadyCreated) {
      spanId = this.tracingService.createSpan({
        task_id: taskId,
        name: `skill:${name}`,
        kind: SpanKind.INTERNAL,
        input: JSON.stringify({ skill: name, args }),
      });
    }

    return new Promise((resolve, reject) => {
        let command: string;
        let cmdArgs: string[];

        if (entryPoint.endsWith('.js')) {
            command = 'node';
            cmdArgs = [entryPath, ...args];
        } else if (entryPoint.endsWith('.sh')) {
            command = 'sh';
            cmdArgs = [entryPath, ...args];
        } else if (entryPoint.endsWith('.py')) {
            command = 'python3';
            cmdArgs = [entryPath, ...args];
        } else {
             // Complete span with error before rejecting
             if (spanId && this.tracingService) {
               this.tracingService.failSpan(spanId, `Unsupported entry point: ${entryPoint}`);
             }
             reject(new Error(`Unsupported entry point: ${entryPoint}`));
             return;
        }

        const child = spawn(command, cmdArgs, {
            cwd: skill.path,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            const durationMs = Date.now() - startTime;

            // Phase 3c: Complete span based on exit code
            if (spanId && this.tracingService) {
              if (code === 0) {
                this.tracingService.completeSpan(spanId, JSON.stringify({
                  code,
                  duration_ms: durationMs
                }));
              } else {
                this.tracingService.failSpan(spanId, `Skill exited with code ${code}`);
              }
            }

            resolve({ code: code || 0, output: '' });
        });

        child.on('error', (err) => {
            // Phase 3c: Complete span with error
            if (spanId && this.tracingService) {
              this.tracingService.failSpan(spanId, err.message);
            }

            reject(err);
        });
    });
  }

  async executeShell(name: string, commandString: string): Promise<{ code: number }> {
    const skill = await this.getSkill(name);
    if (!skill) {
      throw new Error(`Skill '${name}' not found`);
    }

    // Prepare Environment Variables
    const taskId = process.env.CREWX_TASK_ID;
    const env = {
      ...process.env,
      SKILL_DIR: skill.path,
      CREWX_TASK_ID: taskId || '',
    };

    // Tracing
    const spanAlreadyCreated = process.env.CREWX_SKILL_SPAN_CREATED === 'true';
    let spanId: string | null = null;
    const startTime = Date.now();

    if (taskId && this.tracingService?.isEnabled() && !spanAlreadyCreated) {
      spanId = this.tracingService.createSpan({
        task_id: taskId,
        name: `skill:exec:${name}`,
        kind: SpanKind.INTERNAL,
        input: JSON.stringify({ skill: name, command: commandString }),
      });
    }

    return new Promise((resolve, reject) => {
      // Execute in project root (cwd: process.cwd())
      // Use shell: true to allow variable expansion ($SKILL_DIR)
      const child = spawn(commandString, {
        cwd: process.cwd(),
        shell: true,
        env: env,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        const durationMs = Date.now() - startTime;
        if (spanId && this.tracingService) {
          if (code === 0) {
            this.tracingService.completeSpan(spanId, JSON.stringify({ code, duration_ms: durationMs }));
          } else {
            this.tracingService.failSpan(spanId, `Skill shell exited with code ${code}`);
          }
        }
        resolve({ code: code || 0 });
      });

      child.on('error', (err) => {
        if (spanId && this.tracingService) {
          this.tracingService.failSpan(spanId, err.message);
        }
        reject(err);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Skill Installation
  // ─────────────────────────────────────────────────────────────────────────

  async add(sourceStr: string): Promise<{ success: boolean; name: string; message: string }> {
    const source = this.parseSource(sourceStr);
    if (!source) {
      return {
        success: false,
        name: '',
        message: `Invalid source format: ${sourceStr}. Use npm:<package>, template:<name>, or github:<owner/repo>`
      };
    }

    switch (source.type) {
      case 'npm':
        return this.addFromNpm(source.package);
      case 'template':
        return this.addFromTemplate(source.name);
      case 'github':
        return {
          success: false,
          name: '',
          message: 'GitHub source is planned for Phase 1.5 (v0.8.1+). Use npm: or template: for now.'
        };
      default:
        return { success: false, name: '', message: `Unknown source type` };
    }
  }

  /**
   * Validates npm package name to prevent command injection.
   * Valid package names: @scope/name, name, name@version
   * Invalid: anything with shell metacharacters
   */
  private validatePackageName(packageName: string): boolean {
    // Prevent argument injection: package name must not start with a hyphen
    if (packageName.startsWith('-')) {
      return false;
    }

    // npm package name regex: optional @scope/, name, optional @version
    // Allows: letters, numbers, -, _, ., @, /
    // Must not contain shell metacharacters: ; | & $ ` " ' \ ( ) { } [ ] < > ! # * ?
    const validNpmPackagePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9-._~]+)?$/i;
    return validNpmPackagePattern.test(packageName);
  }

  private async addFromNpm(packageName: string): Promise<{ success: boolean; name: string; message: string }> {
    this.ensureInstalledSkillsDir();

    // Validate package name to prevent command injection
    if (!this.validatePackageName(packageName)) {
      return {
        success: false,
        name: '',
        message: `Invalid package name: ${packageName}. Package name contains invalid characters.`
      };
    }

    try {
      // Create temp directory for npm install
      const tempDir = path.join(this.crewxDir, '.tmp-install');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Initialize package.json in temp dir
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'temp', private: true }));

      // Install the package
      this.logger.log(`Installing ${packageName} from npm...`);
      execSync(`npm install ${packageName} --prefix "${tempDir}"`, {
        stdio: 'inherit'
      });

      // Find the installed package
      const nodeModulesPath = path.join(tempDir, 'node_modules');
      const installedPkgPath = this.findInstalledPackage(nodeModulesPath, packageName);

      if (!installedPkgPath) {
        fs.rmSync(tempDir, { recursive: true });
        return { success: false, name: '', message: `Failed to locate installed package: ${packageName}` };
      }

      // Check for SKILL.md
      const skillMdPath = path.join(installedPkgPath, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        fs.rmSync(tempDir, { recursive: true });
        return { success: false, name: '', message: `Package ${packageName} does not contain a SKILL.md file` };
      }

      // Parse skill manifest
      const manifest = parseSkillManifestFromFile(skillMdPath, {
        loadContent: false,
        validationMode: 'lenient'
      });

      const skillName = manifest.metadata.name || path.basename(installedPkgPath);
      const skillVersion = manifest.metadata.version || '0.0.0';

      // Check for existing custom skill (which takes priority)
      const customSkillPath = path.join(process.cwd(), 'skills', skillName);
      if (fs.existsSync(customSkillPath)) {
        fs.rmSync(tempDir, { recursive: true });
        return {
          success: false,
          name: skillName,
          message: `Skill '${skillName}' already exists in skills/ directory (custom skills take priority)`
        };
      }

      // Move to installed skills directory
      const targetPath = path.join(this.installedSkillsDir, skillName);
      if (fs.existsSync(targetPath)) {
        // Remove existing installation for update
        fs.rmSync(targetPath, { recursive: true });
      }

      // Copy package to installed skills
      this.copyDir(installedPkgPath, targetPath);

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true });

      // Update registry
      const registry = this.loadRegistry();
      registry.skills[skillName] = {
        source: 'npm',
        package: packageName,
        version: skillVersion,
        installed: new Date().toISOString()
      };
      this.saveRegistry(registry);

      return {
        success: true,
        name: skillName,
        message: `Successfully installed ${skillName}@${skillVersion} from npm:${packageName}`
      };
    } catch (e) {
      return { success: false, name: '', message: `Failed to install from npm: ${e}` };
    }
  }

  private findInstalledPackage(nodeModulesPath: string, packageName: string): string | null {
    // Handle scoped packages (e.g., @crewx/memory)
    if (packageName.startsWith('@')) {
      const parts = packageName.split('/');
      const scope = parts[0];
      const name = parts[1];
      if (scope && name) {
        const scopedPath = path.join(nodeModulesPath, scope, name);
        if (fs.existsSync(scopedPath)) {
          return scopedPath;
        }
      }
    } else {
      const directPath = path.join(nodeModulesPath, packageName);
      if (fs.existsSync(directPath)) {
        return directPath;
      }
    }
    return null;
  }

  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name === 'node_modules') continue;
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private async addFromTemplate(templateName: string): Promise<{ success: boolean; name: string; message: string }> {
    this.ensureInstalledSkillsDir();

    // Built-in templates (stored in skills/ directory of the project)
    const builtInTemplates: Record<string, { description: string; files: Record<string, string> }> = {
      hello: {
        description: 'Simple greeting demo skill',
        files: {
          'SKILL.md': `---
name: {{name}}
description: A simple greeting skill
version: 0.0.1
---

# {{name}} Skill

A simple greeting skill created from template.

## Usage
\`\`\`bash
node skills/{{name}}/{{name}}.js [name]
\`\`\`
`,
          '{{name}}.js': `#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node {{name}}.js [name]');
  process.exit(0);
}

const name = args[0] || 'World';
console.log(\`Hello, \${name}! (from {{name}} skill)\`);
`
        }
      },
      memory: {
        description: 'Key-value memory storage skill',
        files: {
          'SKILL.md': `---
name: {{name}}
description: Simple key-value memory storage
version: 0.0.1
---

# {{name}} Skill

A simple key-value memory storage skill.

## Commands
- \`save <key> <value>\` - Save a value
- \`load <key>\` - Load a value
- \`list\` - List all keys
- \`delete <key>\` - Delete a key
`,
          '{{name}}.js': `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'save':
    const data = loadData();
    data[args[0]] = args.slice(1).join(' ');
    saveData(data);
    console.log(\`Saved: \${args[0]}\`);
    break;
  case 'load':
    const stored = loadData();
    console.log(stored[args[0]] || '(not found)');
    break;
  case 'list':
    console.log(Object.keys(loadData()).join('\\n') || '(empty)');
    break;
  case 'delete':
    const d = loadData();
    delete d[args[0]];
    saveData(d);
    console.log(\`Deleted: \${args[0]}\`);
    break;
  default:
    console.log('Usage: {{name}}.js <save|load|list|delete> [args]');
}
`
        }
      },
      api: {
        description: 'HTTP API client skill',
        files: {
          'SKILL.md': `---
name: {{name}}
description: HTTP API client skill
version: 0.0.1
---

# {{name}} Skill

An HTTP API client skill for making REST requests.

## Commands
- \`get <url>\` - GET request
- \`post <url> <data>\` - POST request with JSON data
`,
          '{{name}}.js': `#!/usr/bin/env node

const https = require('https');
const http = require('http');

const [method, url, ...rest] = process.argv.slice(2);

if (!method || !url) {
  console.log('Usage: {{name}}.js <get|post> <url> [data]');
  process.exit(1);
}

const client = url.startsWith('https') ? https : http;

const req = client.request(url, { method: method.toUpperCase() }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

if (method.toLowerCase() === 'post' && rest.length) {
  req.setHeader('Content-Type', 'application/json');
  req.write(rest.join(' '));
}

req.end();
`
        }
      }
    };

    const template = builtInTemplates[templateName];
    if (!template) {
      const available = Object.keys(builtInTemplates).join(', ');
      return {
        success: false,
        name: '',
        message: `Template '${templateName}' not found. Available: ${available}`
      };
    }

    // Generate a unique skill name if needed
    let skillName = templateName;
    let counter = 1;
    while (fs.existsSync(path.join(this.installedSkillsDir, skillName)) ||
           fs.existsSync(path.join(process.cwd(), 'skills', skillName))) {
      skillName = `${templateName}-${counter}`;
      counter++;
    }

    // Create skill directory
    const targetPath = path.join(this.installedSkillsDir, skillName);
    fs.mkdirSync(targetPath, { recursive: true });

    // Create files from template
    for (const [fileNameTemplate, contentTemplate] of Object.entries(template.files)) {
      const fileName = fileNameTemplate.replace(/\{\{name\}\}/g, skillName);
      const content = contentTemplate.replace(/\{\{name\}\}/g, skillName);
      const filePath = path.join(targetPath, fileName);
      fs.writeFileSync(filePath, content);

      // Make .js files executable
      if (fileName.endsWith('.js')) {
        fs.chmodSync(filePath, '755');
      }
    }

    // Update registry
    const registry = this.loadRegistry();
    registry.skills[skillName] = {
      source: 'template',
      template: templateName,
      version: '0.0.1',
      installed: new Date().toISOString()
    };
    this.saveRegistry(registry);

    return {
      success: true,
      name: skillName,
      message: `Successfully created skill '${skillName}' from template '${templateName}' at .crewx/skills/${skillName}/`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Skill Removal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validates skill name to prevent path traversal attacks.
   * Valid names: alphanumeric with hyphens, underscores, dots
   * Invalid: anything with path separators (.., /, \)
   */
  private validateSkillName(name: string): boolean {
    // Prevent path traversal: explicitly reject . and ..
    if (name === '.' || name === '..') {
      return false;
    }

    // Skill name should not contain path separators or traversal patterns
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      return false;
    }
    // Additional validation: only allow safe characters
    const validSkillNamePattern = /^[a-z0-9-._~]+$/i;
    return validSkillNamePattern.test(name);
  }

  async remove(name: string): Promise<{ success: boolean; message: string }> {
    // Validate skill name to prevent path traversal
    if (!this.validateSkillName(name)) {
      return {
        success: false,
        message: `Invalid skill name: '${name}'. Skill name cannot contain path separators (/, \\, ..).`
      };
    }

    // Check if it's an installed skill (in .crewx/skills/)
    const installedPath = path.join(this.installedSkillsDir, name);
    const registry = this.loadRegistry();

    if (!fs.existsSync(installedPath)) {
      // Check if it's a custom skill
      const customPath = path.join(process.cwd(), 'skills', name);
      if (fs.existsSync(customPath)) {
        return {
          success: false,
          message: `'${name}' is a custom skill in skills/ directory. Remove it manually if intended.`
        };
      }
      return { success: false, message: `Skill '${name}' not found in installed skills.` };
    }

    try {
      // Remove the skill directory
      fs.rmSync(installedPath, { recursive: true });

      // Remove from registry
      delete registry.skills[name];
      this.saveRegistry(registry);

      return { success: true, message: `Successfully removed skill '${name}'` };
    } catch (e) {
      return { success: false, message: `Failed to remove skill '${name}': ${e}` };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Query
  // ─────────────────────────────────────────────────────────────────────────

  getRegistry(): SkillRegistry {
    return this.loadRegistry();
  }

  getAvailableTemplates(): string[] {
    return ['hello', 'memory', 'api'];
  }
}
