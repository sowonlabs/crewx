/**
 * Unit tests for skills parser and validator
 * Tests WBS-16 Phase 2: SDK Parser/Validator Implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCrewxConfig,
  parseSkillManifest,
  validateSkillMetadata,
  loadSkillContent,
  clearSkillCache,
  parseCrewxConfigFromFile,
  parseSkillManifestFromFile,
} from '../../src/schema/skills-parser';
import {
  SkillLoadError,
  SkillMetadata,
  SkillDefinition,
  CrewxProjectConfig,
} from '../../src/schema/skills.types';

describe('parseCrewxConfig', () => {
  beforeEach(() => {
    clearSkillCache();
  });

  it('should parse valid crewx.yaml with skills configuration', () => {
    const yaml = `
skills_paths:
  - "./skills"
  - "../shared-skills"

skills:
  include:
    - "code-formatter"
    - "git-commit-generator"
  exclude:
    - "deprecated-skill"
  autoload: true

agents:
  - id: "developer"
    provider: "cli/claude"
    skills:
      include:
        - "code-formatter"
`;

    const config = parseCrewxConfig(yaml);

    expect(config.skills_paths).toEqual(['./skills', '../shared-skills']);
    expect(config.skills?.include).toEqual(['code-formatter', 'git-commit-generator']);
    expect(config.skills?.exclude).toEqual(['deprecated-skill']);
    expect(config.skills?.autoload).toBe(true);
    expect(config.agents).toHaveLength(1);
    expect(config.agents?.[0].id).toBe('developer');
    expect(config.agents?.[0].skills?.include).toEqual(['code-formatter']);
  });

  it('should parse minimal crewx.yaml without skills', () => {
    const yaml = `
agents:
  - id: "basic_agent"
    provider: "cli/claude"
`;

    const config = parseCrewxConfig(yaml);

    expect(config.agents).toHaveLength(1);
    expect(config.agents?.[0].id).toBe('basic_agent');
    expect(config.skills).toBeUndefined();
    expect(config.skills_paths).toBeUndefined();
  });

  it('should parse layouts and documents', () => {
    const yaml = `
layouts:
  default: "./layouts/default.hbs"

documents:
  readme: "./README.md"

agents:
  - id: "agent1"
    provider: "cli/claude"
`;

    const config = parseCrewxConfig(yaml);

    expect(config.layouts).toEqual({ default: './layouts/default.hbs' });
    expect(config.documents).toEqual({ readme: './README.md' });
  });

  it('should parse settings', () => {
    const yaml = `
settings:
  slack:
    log_conversations: true

agents:
  - id: "agent1"
    provider: "cli/claude"
`;

    const config = parseCrewxConfig(yaml);

    expect(config.settings?.slack?.log_conversations).toBe(true);
  });

  it('should throw error for invalid YAML', () => {
    const yaml = `
invalid yaml: [1, 2
`;

    expect(() => parseCrewxConfig(yaml)).toThrow(SkillLoadError);
  });

  it('should throw error for empty string', () => {
    expect(() => parseCrewxConfig('')).toThrow(SkillLoadError);
  });

  it('should throw error for non-object YAML', () => {
    const yaml = `just a string`;

    expect(() => parseCrewxConfig(yaml)).toThrow(SkillLoadError);
  });

  it('should handle invalid skills_paths in strict mode', () => {
    const yaml = `
skills_paths: "not an array"
agents: []
`;

    expect(() => parseCrewxConfig(yaml, { validationMode: 'strict' })).toThrow(SkillLoadError);
  });

  it('should handle invalid skills_paths in lenient mode', () => {
    const yaml = `
skills_paths: "not an array"
agents: []
`;

    const config = parseCrewxConfig(yaml, { validationMode: 'lenient' });
    expect(config.skills_paths).toBeUndefined();
  });

  it('should filter non-string entries in skills_paths array', () => {
    const yaml = `
skills_paths:
  - "./valid-path"
  - 123
  - true
  - "./another-valid"
`;

    const config = parseCrewxConfig(yaml);
    expect(config.skills_paths).toEqual(['./valid-path', './another-valid']);
  });

  it('should parse agent skills configuration', () => {
    const yaml = `
agents:
  - id: "dev1"
    provider: "cli/claude"
    skills:
      include: ["skill1", "skill2"]
      exclude: ["skill3"]
      autoload: false
`;

    const config = parseCrewxConfig(yaml);
    expect(config.agents?.[0].skills?.include).toEqual(['skill1', 'skill2']);
    expect(config.agents?.[0].skills?.exclude).toEqual(['skill3']);
    expect(config.agents?.[0].skills?.autoload).toBe(false);
  });

  it('should preserve additional fields', () => {
    const yaml = `
customField: "custom value"
agents:
  - id: "agent1"
    provider: "cli/claude"
`;

    const config = parseCrewxConfig(yaml);
    expect(config.customField).toBe('custom value');
  });
});

describe('parseSkillManifest', () => {
  beforeEach(() => {
    clearSkillCache();
  });

  const validSkillMarkdown = `---
name: code-formatter
description: "Formats code snippets in various programming languages"
version: "1.0.0"
dependencies:
  - "code-analyzer@2.5.0"
runtime:
  python: ">=3.11"
visibility: public
---

## Role
You are an expert code formatter with deep knowledge of programming language conventions.

## Task
Format code according to language-specific style guides and best practices.

## Instructions
1. Identify the programming language
2. Apply appropriate formatting rules
3. Preserve code functionality
4. Output formatted code
`;

  it('should parse valid skill manifest with metadata only', () => {
    const skill = parseSkillManifest(validSkillMarkdown, { loadContent: false });

    expect(skill.metadata.name).toBe('code-formatter');
    expect(skill.metadata.description).toBe('Formats code snippets in various programming languages');
    expect(skill.metadata.version).toBe('1.0.0');
    expect(skill.metadata.dependencies).toEqual(['code-analyzer@2.5.0']);
    expect(skill.metadata.runtime?.python).toBe('>=3.11');
    expect(skill.metadata.visibility).toBe('public');
    expect(skill.fullyLoaded).toBe(false);
    expect(skill.content).toBeUndefined();
  });

  it('should parse valid skill manifest with full content', () => {
    const skill = parseSkillManifest(validSkillMarkdown, { loadContent: true });

    expect(skill.metadata.name).toBe('code-formatter');
    expect(skill.fullyLoaded).toBe(true);
    expect(skill.content).toBeDefined();
    expect(skill.content?.role).toContain('expert code formatter');
    expect(skill.content?.task).toContain('Format code according to');
    expect(skill.content?.instructions).toContain('1. Identify the programming language');
    expect(skill.content?.raw).toContain('## Role');
  });

  it('should parse minimal skill manifest', () => {
    const markdown = `---
name: simple-skill
description: "A simple skill"
version: "1.0.0"
---

## Role
Simple role
`;

    const skill = parseSkillManifest(markdown);

    expect(skill.metadata.name).toBe('simple-skill');
    expect(skill.metadata.dependencies).toBeUndefined();
    expect(skill.metadata.runtime).toBeUndefined();
    expect(skill.metadata.visibility).toBeUndefined();
  });

  it('should throw error for missing frontmatter', () => {
    const markdown = `
## Role
Some role content
`;

    expect(() => parseSkillManifest(markdown)).toThrow(SkillLoadError);
    expect(() => parseSkillManifest(markdown)).toThrow(/frontmatter/i);
  });

  it('should throw error for invalid frontmatter YAML', () => {
    const markdown = `---
invalid: [ yaml
---
`;

    expect(() => parseSkillManifest(markdown)).toThrow(SkillLoadError);
  });

  it('should throw error for empty content', () => {
    expect(() => parseSkillManifest('')).toThrow(SkillLoadError);
  });

  it('should throw error for missing required fields in strict mode', () => {
    const markdown = `---
name: "incomplete-skill"
---
`;

    expect(() => parseSkillManifest(markdown, { validationMode: 'strict' })).toThrow(SkillLoadError);
  });

  it('should handle missing required fields in lenient mode', () => {
    const markdown = `---
name: "incomplete-skill"
---
`;

    const skill = parseSkillManifest(markdown, { validationMode: 'lenient' });
    expect(skill.metadata.name).toBe('incomplete-skill');
  });

  it('should extract content sections correctly', () => {
    const markdown = `---
name: test-skill
description: "Test skill"
version: "1.0.0"
---

## Role
This is the role section.

## Task
This is the task section.

## Instructions
1. Step one
2. Step two

## Additional Section
This should not be extracted.
`;

    const skill = parseSkillManifest(markdown, { loadContent: true });

    expect(skill.content?.role).toBe('This is the role section.');
    expect(skill.content?.task).toBe('This is the task section.');
    expect(skill.content?.instructions).toContain('1. Step one');
    expect(skill.content?.raw).toContain('## Additional Section');
  });

  it('should preserve custom metadata fields', () => {
    const markdown = `---
name: custom-skill
description: "Skill with custom fields"
version: "1.0.0"
author: "John Doe"
tags:
  - "formatter"
  - "code"
---

## Role
Role content
`;

    const skill = parseSkillManifest(markdown);

    expect(skill.metadata.author).toBe('John Doe');
    expect(skill.metadata.tags).toEqual(['formatter', 'code']);
  });

  it('should validate visibility values', () => {
    const markdown = `---
name: invalid-visibility
description: "Test"
version: "1.0.0"
visibility: "invalid-value"
---
`;

    expect(() => parseSkillManifest(markdown, { validationMode: 'strict' })).toThrow(SkillLoadError);
  });
});

describe('validateSkillMetadata', () => {
  it('should validate correct metadata', () => {
    const metadata: SkillMetadata = {
      name: 'code-formatter',
      description: 'Formats code snippets in various languages',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing name', () => {
    const metadata: SkillMetadata = {
      name: '',
      description: 'Valid description',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should detect invalid name format', () => {
    const metadata: SkillMetadata = {
      name: 'Invalid_Name',
      description: 'Valid description',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name' && e.message.includes('kebab-case'))).toBe(true);
  });

  it('should warn for long name', () => {
    const metadata: SkillMetadata = {
      name: 'a'.repeat(51),
      description: 'Valid description',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.warnings?.some((w) => w.field === 'name' && w.message.includes('50 characters'))).toBe(true);
  });

  it('should detect missing description', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: '',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('should warn for short description', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'Short',
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.warnings?.some((w) => w.field === 'description' && w.message.includes('10 characters'))).toBe(true);
  });

  it('should warn for long description', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'a'.repeat(201),
      version: '1.0.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.warnings?.some((w) => w.field === 'description' && w.message.includes('200 characters'))).toBe(true);
  });

  it('should detect missing version', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'Valid description',
      version: '',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'version')).toBe(true);
  });

  it('should detect invalid version format', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'Valid description',
      version: '1.0',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'version' && e.message.includes('semantic versioning'))).toBe(true);
  });

  it('should validate dependency format', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'Valid description',
      version: '1.0.0',
      dependencies: ['valid-skill', 'another-skill@2.0.0', 'Invalid_Dep'],
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('dependencies[2]'))).toBe(true);
  });

  it('should accept valid dependency formats', () => {
    const metadata: SkillMetadata = {
      name: 'skill-name',
      description: 'Valid description',
      version: '1.0.0',
      dependencies: ['skill-one', 'skill-two@1.0.0'],
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(true);
  });
});

describe('Progressive disclosure', () => {
  beforeEach(() => {
    clearSkillCache();
  });

  it('should support progressive loading pattern', () => {
    const markdown = `---
name: progressive-skill
description: "Test progressive disclosure"
version: "1.0.0"
---

## Role
Role content

## Task
Task content
`;

    // Step 1: Load metadata only (fast)
    const metadataOnly = parseSkillManifest(markdown, { loadContent: false });
    expect(metadataOnly.fullyLoaded).toBe(false);
    expect(metadataOnly.content).toBeUndefined();

    // Step 2: Load full content (on demand)
    const fullContent = parseSkillManifest(markdown, { loadContent: true });
    expect(fullContent.fullyLoaded).toBe(true);
    expect(fullContent.content).toBeDefined();
    expect(fullContent.content?.role).toContain('Role content');
  });

  it('should cache parsed content', () => {
    const markdown = `---
name: cached-skill
description: "Test caching"
version: "1.0.0"
---

## Role
Cached role
`;

    // Parse once
    const skill1 = parseSkillManifest(markdown, { loadContent: true });

    // Parse again (should use cache)
    const skill2 = parseSkillManifest(markdown, { loadContent: true });

    expect(skill1.metadata.name).toBe(skill2.metadata.name);
  });

  it('should clear cache correctly', () => {
    const markdown = `---
name: clear-cache-test
description: "Test cache clearing"
version: "1.0.0"
---
`;

    parseSkillManifest(markdown);
    clearSkillCache();

    // Cache should be empty now
    expect(() => clearSkillCache()).not.toThrow();
  });
});

describe('Error handling', () => {
  it('should provide clear error messages for missing frontmatter', () => {
    const markdown = 'Just markdown without frontmatter';

    try {
      parseSkillManifest(markdown);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError);
      expect((error as SkillLoadError).message).toContain('frontmatter');
    }
  });

  it('should provide clear error messages for validation failures', () => {
    const metadata: SkillMetadata = {
      name: 'Invalid Name',
      description: '',
      version: 'invalid',
    };

    const result = validateSkillMetadata(metadata);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeDefined();
    expect(result.errors[0].field).toBeDefined();
  });

  it('should handle YAML parsing errors gracefully', () => {
    const yaml = `
agents:
  - id: "test"
    invalid: [ bracket
`;

    try {
      parseCrewxConfig(yaml);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError);
      expect((error as SkillLoadError).message).toContain('parse YAML');
    }
  });
});

describe('Validation modes', () => {
  it('should throw errors in strict mode', () => {
    const yaml = `
skills_paths: "invalid"
`;

    expect(() => parseCrewxConfig(yaml, { validationMode: 'strict' })).toThrow(SkillLoadError);
  });

  it('should not throw errors in lenient mode', () => {
    const yaml = `
skills_paths: "invalid"
agents: []
`;

    const config = parseCrewxConfig(yaml, { validationMode: 'lenient' });
    expect(config).toBeDefined();
  });
});
