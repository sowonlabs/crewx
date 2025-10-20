# WBS-17 Phase 2: AppManifest & Bundle Builder Design

## Overview

This document outlines the design for AppManifest format and skill bundling strategy as part of WBS-17 Phase 2. The goal is to create a standardized format for packaging CrewX skills with their metadata, runtime requirements, and resources for future marketplace/registry integration.

## Background

- **Phase 1 Complete**: SkillRuntime architecture and progressive disclosure implemented (2025-10-20)
- **Current State**: Skills exist as individual `skills.md` files with YAML frontmatter
- **Next Step**: Design packaging format that bundles skills with their resources and metadata
- **Future Goal**: Enable skill marketplace/registry distribution

## Design Requirements

### Core Requirements
1. **Package Format**: Define how skills.md + resources should be bundled together
2. **Metadata Storage**: What metadata needs to be stored with bundled skills?
3. **Runtime Requirements**: How should runtimeRequirements metadata be included?
4. **Version Management**: Version, signature, and compatibility fields
5. **Validation Strategy**: How to validate bundled packages
6. **Backward Compatibility**: Work with existing skills/ directory structure

### Use Cases to Support

#### Use Case 1: Single Skill Package
```bash
# Developer wants to package and share one skill
skill bundle create code-formatter.skills.md --output code-formatter.crewx
```

#### Use Case 2: Multi-Skill Collection
```bash
# Package a collection of related skills
skill bundle create skills/ --name "data-analysis-tools" --output data-analysis-tools.crewx
```

#### Use Case 3: Registry Distribution
```bash
# Publish to registry
skill registry publish data-analysis-tools.crewx

# Install from registry
skill registry install data-analysis-tools
```

#### Use Case 4: Runtime Installation
```bash
# Runtime discovers and installs required skills
crewx execute "@data-analyzer analyze dataset.csv"
# → Auto-installs data-analyzer skill bundle if not present
```

## AppManifest Schema Design

### Core Manifest Structure

```json
{
  "manifestVersion": "1.0.0",
  "packageType": "skill-bundle",
  "id": "data-analysis-tools",
  "version": "1.2.3",
  "metadata": {
    "name": "Data Analysis Tools",
    "description": "Collection of data analysis and visualization skills",
    "author": {
      "name": "CrewX Team",
      "email": "team@crewx.dev",
      "url": "https://crewx.dev"
    },
    "license": "MIT",
    "homepage": "https://github.com/crewx/skills/data-analysis-tools",
    "repository": {
      "type": "git",
      "url": "https://github.com/crewx/skills.git"
    },
    "keywords": ["data-analysis", "visualization", "python"],
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-20T15:30:00Z"
  },
  "skills": [
    {
      "id": "data-analyzer",
      "path": "skills/data-analyzer.md",
      "entry": "data-analyzer.md",
      "metadata": {
        "name": "Data Analyzer",
        "description": "Analyzes large datasets with Python",
        "version": "2.1.0",
        "runtime": {
          "python": ">=3.11",
          "memory": "4GB",
          "dependencies": ["pandas>=2.0.0", "numpy>=1.24.0"]
        }
      }
    },
    {
      "id": "data-visualizer", 
      "path": "skills/data-visualizer.md",
      "entry": "data-visualizer.md",
      "metadata": {
        "name": "Data Visualizer",
        "description": "Creates charts and visualizations",
        "version": "1.5.0",
        "runtime": {
          "python": ">=3.10",
          "memory": "2GB",
          "dependencies": ["matplotlib>=3.7.0", "seaborn>=0.12.0"]
        }
      }
    }
  ],
  "resources": [
    {
      "type": "python-script",
      "path": "scripts/analysis_utils.py",
      "description": "Utility functions for data analysis"
    },
    {
      "type": "template",
      "path": "templates/chart_template.html",
      "description": "HTML template for chart embedding"
    }
  ],
  "runtimeRequirements": {
    "python": ">=3.11",
    "node": ">=18.0.0",
    "docker": true,
    "memory": "4GB",
    "diskSpace": "1GB"
  },
  "dependencies": {
    "crewx": ">=0.2.0",
    "skills": [
      {
        "id": "python-data-libs",
        "version": ">=1.5.0",
        "optional": false
      }
    ]
  },
  "compatibility": {
    "crewxVersion": ">=0.2.0",
    "platforms": ["linux", "darwin", "win32"],
    "architectures": ["x64", "arm64"]
  },
  "security": {
    "signature": "sha256:abc123...",
    "trustedSources": ["https://registry.crewx.dev"],
    "permissions": ["file-read", "file-write", "network"]
  },
  "installation": {
    "type": "bundle",
    "location": "skills/",
    "autoUpdate": true,
    "verifySignature": true
  }
}
```

### Manifest Field Explanations

#### Core Identity Fields
- `manifestVersion`: Schema version for format evolution
- `packageType`: Always "skill-bundle" for now (extensible for future types)
- `id`: Unique package identifier (npm-style naming)
- `version`: Semantic version following SemVer 2.0

#### Metadata Fields
- `metadata`: Package-level information
- `author`: Creator information with contact details
- `license`: Software license (SPDX identifier)
- `keywords`: Array of searchable terms
- `createdAt/updatedAt`: Timestamps for tracking

#### Skills Array
- `skills`: List of skills included in this bundle
- Each skill has:
  - `id`: Unique skill identifier within bundle
  - `path`: Relative path within bundle
  - `entry`: Main skill file (usually .md)
  - `metadata`: Skill-specific metadata from frontmatter

#### Resources Array  
- `resources`: Additional files needed by skills
- Types: `python-script`, `template`, `config`, `data`, `binary`
- Each resource has path and description

#### Runtime Requirements
- `runtimeRequirements`: Aggregated requirements from all skills
- Includes: python, node, docker, memory, diskSpace
- Derived from skill metadata during bundling

#### Dependencies
- `dependencies`: Package dependencies (crewx version, other skill bundles)
- Supports optional dependencies
- Version ranges using SemVer syntax

#### Compatibility
- `compatibility`: Platform and version compatibility
- `crewxVersion`: Minimum CrewX SDK version required
- `platforms`: Supported operating systems
- `architectures`: Supported CPU architectures

#### Security
- `security`: Signature and trust information
- `signature`: Cryptographic signature for verification
- `trustedSources`: Allowlist of download sources
- `permissions`: Required permissions for skill execution

#### Installation
- `installation`: Installation behavior preferences
- `type`: Installation method (bundle, individual, reference)
- `location`: Where to install relative to project
- `autoUpdate`: Whether to auto-update this package
- `verifySignature`: Signature verification requirement

## Bundle Format Analysis

### Option 1: TAR + JSON Manifest (RECOMMENDED)

#### Structure
```
data-analysis-tools.crewx (TAR archive)
├── manifest.json              # AppManifest
├── skills/
│   ├── data-analyzer.md      # Skill definition
│   └── data-visualizer.md    # Skill definition  
├── scripts/
│   └── analysis_utils.py     # Python utility script
├── templates/
│   └── chart_template.html   # HTML template
└── README.md                 # Package documentation
```

#### Pros
- ✅ **Standard Format**: TAR is universally supported
- ✅ **Compression**: Efficient storage and transfer
- ✅ **Preserves Permissions**: Unix permissions maintained
- ✅ **Streaming Support**: Can be read/written as streams
- ✅ **Tooling Support**: Native support in all platforms
- ✅ **Appendable**: Can add files without full rewrite

#### Cons
- ❌ **Binary Format**: Not human-readable without extraction
- ❌ **No Random Access**: Must extract entire archive to read manifest

#### Implementation
```typescript
interface BundleBuilder {
  createBundle(options: BundleOptions): Promise<BundleResult>;
  extractBundle(bundlePath: string, targetPath: string): Promise<void>;
  validateBundle(bundlePath: string): Promise<ValidationResult>;
  readManifest(bundlePath: string): Promise<AppManifest>;
}

class TarBundleBuilder implements BundleBuilder {
  async createBundle(options: BundleOptions): Promise<BundleResult> {
    // 1. Generate manifest.json
    const manifest = await this.generateManifest(options);
    
    // 2. Create temporary directory structure
    const tempDir = await this.createTempStructure(manifest, options);
    
    // 3. Create TAR archive
    const tarPath = await this.createTarArchive(tempDir, options.outputPath);
    
    // 4. Optionally compress (gzip)
    if (options.compress) {
      await this.compressArchive(tarPath);
    }
    
    return { bundlePath: tarPath, manifest };
  }
}
```

### Option 2: ZIP + JSON Manifest

#### Structure (same as TAR, but ZIP format)
```
data-analysis-tools.crewx (ZIP archive)
├── manifest.json
├── skills/
├── scripts/
├── templates/
└── README.md
```

#### Pros
- ✅ **Universal Support**: Built-in support in all OSes
- ✅ **Random Access**: Can read individual files without extracting all
- ✅ **Compression**: Built-in compression support
- ✅ **Security**: Built-in signature support in some implementations

#### Cons
- ❌ **Complex Format**: More complex than TAR
- ❌ **Permission Issues**: Unix permissions not well-preserved
- ❌ **Size Overhead**: Slightly larger than TAR+gzip

### Option 3: YAML Container Format

#### Structure
```yaml
# crewx-bundle.yaml
manifest:
  manifestVersion: "1.0.0"
  packageType: "skill-bundle"
  # ... manifest fields

skills:
  data-analyzer: |
    ---
    name: Data Analyzer
    version: "2.1.0"
    ---
    ## Role
    You are a data analysis expert...
    
  data-visualizer: |
    ---
    name: Data Visualizer  
    version: "1.5.0"
    ---
    ## Role
    You create beautiful visualizations...

resources:
  scripts/analysis_utils.py: |
    import pandas as pd
    import numpy as np
    # ... Python code
```

#### Pros
- ✅ **Human Readable**: Entire bundle is readable text
- ✅ **Git Friendly**: Can be version controlled easily
- ✅ **Simple Tooling**: Can be processed with basic YAML parsers

#### Cons
- ❌ **Size Inefficient**: No compression, text expansion
- ❌ **Binary Resources**: Poor support for binary files
- ❌ **Large Files**: Becomes unwieldy with many skills/resources
- ❌ **Streaming**: No streaming support

### Option 4: Multi-File Format

#### Structure
```
data-analysis-tools.crewx/
├── manifest.json
├── skills/
│   ├── data-analyzer.skill
│   └── data-visualizer.skill
├── resources/
│   ├── scripts.analysis_utils.py
│   └── templates.chart_template.html
└── signature.sig
```

#### Pros
- ✅ **Modular**: Each skill/resource is separate file
- ✅ **Incremental Updates**: Can update individual components
- ✅ **Clear Structure**: Easy to understand file organization

#### Cons
- ❌ **Distribution Complexity**: Must distribute multiple files
- ❌ **Installation Complexity**: Need to create directory structure
- ❌ **Atomicity**: Hard to ensure all files are installed together

## Recommended Format: TAR + JSON Manifest

Based on the analysis, **TAR + JSON Manifest** is the recommended format because:

1. **Industry Standard**: TAR is the de facto standard for software distribution
2. **Tooling Availability**: Native support in all platforms and languages
3. **Efficiency**: Good compression with gzip
4. **Extensibility**: Easy to add new file types and metadata
5. **Future-Proof**: Can evolve manifest format while preserving compatibility

## Bundle Builder Design

### Core Interface

```typescript
interface BundleBuilder {
  // Bundle creation
  createBundle(options: CreateBundleOptions): Promise<BundleResult>;
  createBundleFromDirectory(dirPath: string, options?: BundleOptions): Promise<BundleResult>;
  createBundleFromSkills(skillPaths: string[], options?: BundleOptions): Promise<BundleResult>;
  
  // Bundle reading
  readManifest(bundlePath: string): Promise<AppManifest>;
  extractBundle(bundlePath: string, targetPath: string, options?: ExtractOptions): Promise<void>;
  listContents(bundlePath: string): Promise<BundleContents>;
  
  // Validation
  validateBundle(bundlePath: string): Promise<ValidationResult>;
  verifySignature(bundlePath: string, publicKey?: string): Promise<boolean>;
  
  // Utilities
  getBundleInfo(bundlePath: string): Promise<BundleInfo>;
  estimateSize(skillPaths: string[]): Promise<SizeEstimate>;
}

interface CreateBundleOptions {
  // Package identity
  id: string;
  version: string;
  name: string;
  description: string;
  
  // Author information
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  
  // Package configuration
  license?: string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  keywords?: string[];
  
  // Output options
  outputPath?: string;
  compress?: boolean;
  signature?: {
    privateKey?: string;
    algorithm?: 'sha256' | 'sha512';
  };
  
  // Runtime options
  autoUpdate?: boolean;
  verifySignature?: boolean;
  installationLocation?: string;
}

interface BundleResult {
  bundlePath: string;
  manifest: AppManifest;
  size: number;
  checksum: string;
  signature?: string;
}
```

### Implementation Strategy

#### Phase 1: Basic TAR Bundle Builder
```typescript
class TarBundleBuilder implements BundleBuilder {
  async createBundle(options: CreateBundleOptions): Promise<BundleResult> {
    // 1. Validate inputs and resolve skill paths
    const resolvedSkills = await this.resolveSkills(options.skillPaths);
    
    // 2. Extract and aggregate metadata
    const manifest = await this.generateManifest(resolvedSkills, options);
    
    // 3. Create temporary directory structure
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crewx-bundle-'));
    await this.createDirectoryStructure(tempDir, manifest, resolvedSkills);
    
    // 4. Create TAR archive
    const tarPath = options.outputPath || `${options.id}-${options.version}.crewx`;
    await this.createTarArchive(tempDir, tarPath);
    
    // 5. Compress if requested
    if (options.compress) {
      await this.gzipArchive(tarPath);
    }
    
    // 6. Generate signature if requested
    let signature: string | undefined;
    if (options.signature) {
      signature = await this.signBundle(tarPath, options.signature.privateKey);
    }
    
    // 7. Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    return {
      bundlePath: tarPath,
      manifest,
      size: (await fs.stat(tarPath)).size,
      checksum: await this.calculateChecksum(tarPath),
      signature
    };
  }
  
  private async generateManifest(
    skills: ResolvedSkill[], 
    options: CreateBundleOptions
  ): Promise<AppManifest> {
    // Aggregate runtime requirements from all skills
    const runtimeRequirements = this.aggregateRuntimeRequirements(skills);
    
    // Build skills array for manifest
    const manifestSkills = skills.map(skill => ({
      id: skill.metadata.name,
      path: skill.relativePath,
      entry: path.basename(skill.filePath),
      metadata: skill.metadata
    }));
    
    // Generate manifest
    return {
      manifestVersion: "1.0.0",
      packageType: "skill-bundle",
      id: options.id,
      version: options.version,
      metadata: {
        name: options.name,
        description: options.description,
        author: options.author,
        license: options.license,
        homepage: options.homepage,
        repository: options.repository,
        keywords: options.keywords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      skills: manifestSkills,
      resources: this.discoverResources(skills),
      runtimeRequirements,
      dependencies: {
        crewx: ">=0.2.0", // Would come from package.json
        skills: []
      },
      compatibility: {
        crewxVersion: ">=0.2.0",
        platforms: ["linux", "darwin", "win32"],
        architectures: ["x64", "arm64"]
      },
      security: {
        trustedSources: ["https://registry.crewx.dev"],
        permissions: this.calculatePermissions(skills)
      },
      installation: {
        type: "bundle",
        location: options.installationLocation || "skills/",
        autoUpdate: options.autoUpdate ?? true,
        verifySignature: options.verifySignature ?? true
      }
    };
  }
}
```

#### Phase 2: Registry Integration Support
```typescript
interface RegistryBundleBuilder extends BundleBuilder {
  // Registry-specific methods
  publishToRegistry(bundlePath: string, registryUrl: string, auth?: AuthConfig): Promise<PublishResult>;
  downloadFromRegistry(packageId: string, version?: string, targetPath?: string): Promise<DownloadResult>;
  searchRegistry(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getPackageInfo(packageId: string, version?: string): Promise<PackageInfo>;
}

class CrewxRegistryBundleBuilder extends TarBundleBuilder implements RegistryBundleBuilder {
  async publishToRegistry(
    bundlePath: string, 
    registryUrl: string, 
    auth?: AuthConfig
  ): Promise<PublishResult> {
    // 1. Validate bundle
    const validation = await this.validateBundle(bundlePath);
    if (!validation.valid) {
      throw new Error(`Bundle validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 2. Read manifest
    const manifest = await this.readManifest(bundlePath);
    
    // 3. Upload bundle to registry
    const uploadResult = await this.uploadBundle(bundlePath, registryUrl, auth);
    
    // 4. Register package metadata
    await this.registerPackage(manifest, registryUrl, auth);
    
    return {
      packageId: manifest.id,
      version: manifest.version,
      uploadUrl: uploadResult.url,
      publishedAt: new Date()
    };
  }
}
```

## Validation Strategy

### Manifest Validation
```typescript
interface ManifestValidator {
  validateManifest(manifest: AppManifest): Promise<ValidationResult>;
  validateSemanticVersion(version: string): boolean;
  validateRuntimeRequirements(requirements: RuntimeRequirements): Promise<boolean>;
  validateDependencies(dependencies: PackageDependencies): Promise<boolean>;
  validateSecurity(security: SecurityConfig): Promise<boolean>;
}

class AppManifestValidator implements ManifestValidator {
  async validateManifest(manifest: AppManifest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields validation
    if (!manifest.id) errors.push('Package ID is required');
    if (!manifest.version) errors.push('Version is required');
    if (!this.validateSemanticVersion(manifest.version)) {
      errors.push('Version must follow semantic versioning (x.y.z)');
    }
    
    // Metadata validation
    if (!manifest.metadata?.name) errors.push('Package name is required');
    if (!manifest.metadata?.description) errors.push('Description is required');
    
    // Skills validation
    if (!manifest.skills?.length) {
      warnings.push('No skills included in bundle');
    } else {
      for (const skill of manifest.skills) {
        if (!skill.id) errors.push(`Skill ID is required for ${skill.path}`);
        if (!skill.path) errors.push(`Skill path is required for ${skill.id}`);
      }
    }
    
    // Runtime requirements validation
    if (manifest.runtimeRequirements) {
      const runtimeValid = await this.validateRuntimeRequirements(manifest.runtimeRequirements);
      if (!runtimeValid) {
        warnings.push('Runtime requirements may not be satisfiable on current system');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        manifestVersion: manifest.manifestVersion,
        packageType: manifest.packageType,
        skillCount: manifest.skills?.length || 0
      }
    };
  }
}
```

### Bundle Validation
```typescript
interface BundleValidator {
  validateBundle(bundlePath: string): Promise<BundleValidationResult>;
  verifyStructure(bundlePath: string): Promise<StructureValidationResult>;
  verifyChecksum(bundlePath: string, expectedChecksum: string): Promise<boolean>;
  verifySignature(bundlePath: string, signature: string, publicKey: string): Promise<boolean>;
}

class BundleValidatorImpl implements BundleValidator {
  async validateBundle(bundlePath: string): Promise<BundleValidationResult> {
    const results = await Promise.all([
      this.verifyStructure(bundlePath),
      this.extractAndValidateManifest(bundlePath),
      this.verifyFileIntegrity(bundlePath)
    ]);
    
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      metadata: {
        bundlePath,
        size: (await fs.stat(bundlePath)).size,
        checksum: await this.calculateChecksum(bundlePath)
      }
    };
  }
  
  private async extractAndValidateManifest(bundlePath: string): Promise<ManifestValidationResult> {
    // Extract manifest.json from bundle
    const manifest = await this.extractManifest(bundlePath);
    
    // Validate manifest structure and content
    const validator = new AppManifestValidator();
    return validator.validateManifest(manifest);
  }
}
```

## Versioning Strategy

### Semantic Versioning (SemVer 2.0)
- **MAJOR**: Breaking changes (manifest format, runtime requirements)
- **MINOR**: New features (new manifest fields, optional dependencies)
- **PATCH**: Bug fixes (validation fixes, documentation updates)

### Compatibility Matrix
| Manifest Version | CrewX Version | Status |
|------------------|---------------|--------|
| 1.0.x | >= 0.2.0 | Current |
| 1.1.x | >= 0.3.0 | Planned |
| 2.0.x | >= 1.0.0 | Future |

### Migration Strategy
```typescript
interface ManifestMigrator {
  migrateManifest(manifest: any, fromVersion: string, toVersion: string): Promise<AppManifest>;
  getMigrationPath(fromVersion: string, toVersion: string): string[];
  canMigrate(fromVersion: string, toVersion: string): boolean;
}

class ManifestMigratorImpl implements ManifestMigrator {
  async migrateManifest(manifest: any, fromVersion: string, toVersion: string): Promise<AppManifest> {
    const migrationPath = this.getMigrationPath(fromVersion, toVersion);
    
    let currentManifest = manifest;
    for (const migration of migrationPath) {
      currentManifest = await this.applyMigration(currentManifest, migration);
    }
    
    return currentManifest as AppManifest;
  }
  
  private async applyMigration(manifest: any, migration: string): Promise<any> {
    switch (migration) {
      case '1.0-to-1.1':
        return this.migrate1_0to1_1(manifest);
      case '1.1-to-2.0':
        return this.migrate1_1to2_0(manifest);
      default:
        throw new Error(`Unknown migration: ${migration}`);
    }
  }
}
```

## Phase 3 Requirements (Registry Mock)

Based on the AppManifest design, Phase 3 will need:

### Registry Mock Requirements
1. **Package Storage**: Simulate package storage and retrieval
2. **Metadata Index**: Searchable package metadata database
3. **Version Management**: Multiple versions per package support
4. **Download Service**: Package download and installation simulation
5. **Authentication**: Mock user authentication and authorization
6. **API Endpoints**: REST API for registry operations

### CLI Integration Requirements
1. **Registry Commands**: `registry login`, `registry publish`, `registry install`
2. **Bundle Commands**: `bundle create`, `bundle validate`, `bundle extract`
3. **Discovery**: `registry search`, `registry info`
4. **Configuration**: Registry URL, authentication, caching

### E2E Test Scenarios
1. **Package Creation**: Create bundle from skills directory
2. **Registry Upload**: Publish bundle to mock registry
3. **Package Discovery**: Search and retrieve package information
4. **Installation**: Install package in new project
5. **Runtime Execution**: Use installed skills in CrewX execution

## Risk Assessment

### Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| TAR format compatibility issues | High | Low | Use well-tested libraries, cross-platform testing |
| Manifest schema evolution complexity | Medium | Medium | Backward compatibility, migration tools |
| Signature verification security | High | Low | Use established crypto libraries, key management |
| Bundle size inflation | Medium | Medium | Compression optimization, resource deduplication |

### Adoption Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Developer workflow disruption | Medium | Medium | CLI tools integration, documentation |
| Skills directory migration complexity | High | Medium | Migration tools, backward compatibility |
| Registry ecosystem acceptance | High | Low | Open-source registry, community building |

## Implementation Timeline

### Phase 2 Implementation Steps
1. **Week 1**: AppManifest schema finalization and TypeScript types
2. **Week 2**: TAR bundle builder implementation with basic validation
3. **Week 3**: CLI integration and bundle management commands
4. **Week 4**: Testing, documentation, and Phase 3 preparation

### Success Criteria
- ✅ TAR bundle format working with skills.md files
- ✅ Manifest generation and validation
- ✅ CLI bundle creation and extraction commands
- ✅ Backward compatibility with existing skills/ directory
- ✅ Comprehensive test coverage
- ✅ Documentation and migration guides

## Next Steps

1. **Finalize Schema**: Review and finalize AppManifest schema with team
2. **Implement Bundle Builder**: Create TAR-based bundle builder
3. **CLI Integration**: Add bundle management commands to CrewX CLI
4. **Testing**: Comprehensive unit and integration tests
5. **Documentation**: User guides and API documentation
6. **Phase 3 Preparation**: Design registry mock based on bundle format

---

## Summary

WBS-17 Phase 2 establishes the AppManifest format and bundling strategy that will enable:

- **Standardized Packaging**: TAR + JSON manifest format for skill distribution
- **Rich Metadata**: Comprehensive metadata for discovery and dependency management
- **Runtime Requirements**: Clear specification of execution environment needs
- **Security**: Signature verification and trust management
- **Future Compatibility**: Extensible format for registry integration
- **Developer Experience**: CLI tools for seamless bundle creation and management

The design provides a solid foundation for Phase 3 registry mock implementation and long-term skill marketplace ecosystem.