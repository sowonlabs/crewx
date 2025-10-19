# Build System Documentation

## Overview

CrewX monorepo uses npm workspaces with TypeScript for building packages. This document covers build configuration, optimization strategies, and troubleshooting.

## Build Architecture

### Package Build Order

Due to workspace dependencies, packages must build in order:

1. **SDK** (`@sowonai/crewx-sdk`) - Independent, no workspace dependencies
2. **CLI** (`crewx`) - Depends on SDK via `workspace:*`

### Build Tools

- **SDK**: Pure TypeScript compilation (`tsc`)
- **CLI**: NestJS CLI (`nest build`) with TypeScript

## Build Commands

### Root Level

```bash
# Build all packages (respects dependency order)
npm run build

# Build specific package
npm run build:sdk
npm run build:cli

# Clean build (remove node_modules and dist)
npm run clean
npm ci
npm run build

# Watch mode (for development)
npm run build:sdk -- --watch
```

### Package Level

```bash
# SDK
cd packages/sdk
npm run build

# CLI
cd packages/cli
npm run build
```

## Build Configuration

### TypeScript Configuration

#### Root: `tsconfig.base.json`

Shared configuration for all packages:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@sowonai/crewx-sdk": ["packages/sdk/dist/index"],
      "@sowonai/crewx-sdk/*": ["packages/sdk/dist/*"]
    }
  }
}
```

#### SDK: `packages/sdk/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "tests", "node_modules"]
}
```

#### CLI: `packages/cli/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@sowonai/crewx-sdk": ["../sdk/dist/index"],
      "@sowonai/crewx-sdk/*": ["../sdk/dist/*"]
    }
  }
}
```

### NestJS Configuration

#### Root: `nest-cli.json`

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["templates/**/*"]
  }
}
```

The CLI package references this with: `nest build -c ../../nest-cli.json`

## Build Optimization

### 1. Incremental Builds

Enable in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "incremental": true
  }
}
```

Benefits:
- Faster subsequent builds
- Only recompiles changed files
- Creates `.tsbuildinfo` cache

Caveat: Disable for SDK (`"incremental": false`) to ensure clean npm builds.

### 2. Source Maps

Control source map generation:

```json
{
  "compilerOptions": {
    "sourceMap": true,          // Development
    "inlineSourceMap": false,   // Production
    "inlineSources": false      // Production
  }
}
```

### 3. Module Resolution

Optimize resolution with:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### 4. Build Performance

Speed up builds:

```bash
# Parallel builds (if independent)
npm run build:sdk & npm run build:cli & wait

# Skip type checking during development
npm run build -- --skipTypeCheck

# Use SWC for faster compilation (future)
# npm install -D @swc/core @swc/cli
```

### 5. Bundle Size Optimization

For CLI distribution:

```bash
# Analyze bundle
npm run build:cli
du -sh packages/cli/dist/*

# Minimize dependencies
# - Use peerDependencies where possible
# - Avoid large libraries in SDK
# - Tree-shake unused code
```

## Build Scripts

### Post-Build Scripts

#### CLI: `postbuild-cli.mjs`

Ensures CLI executable has:
- Shebang (`#!/usr/bin/env node`)
- Execute permissions (`chmod +x`)

```javascript
// Runs automatically after 'npm run build'
// Location: scripts/postbuild-cli.mjs
```

#### CLI: `postinstall-cli.mjs`

Sets execute permissions after npm install:

```javascript
// Runs after 'npm install crewx'
// Location: scripts/postinstall-cli.mjs
```

### Pre-Publish Scripts

SDK and CLI both use `prepack`:

```json
{
  "scripts": {
    "prepack": "npm run build"
  }
}
```

This ensures clean build before publishing.

## Workspace Linking

### How It Works

1. SDK builds to `packages/sdk/dist/`
2. CLI references SDK via `workspace:*` in package.json
3. npm links `@sowonai/crewx-sdk` → `../../packages/sdk`
4. CLI imports use `@sowonai/crewx-sdk` → resolves to `packages/sdk/dist/`

### Path Resolution

TypeScript paths in `tsconfig.json`:

```json
{
  "paths": {
    "@sowonai/crewx-sdk": ["../sdk/dist/index"],
    "@sowonai/crewx-sdk/*": ["../sdk/dist/*"]
  }
}
```

Node.js resolves via npm workspace symlinks.

## Build Verification

### Pre-Flight Checks

```bash
# 1. Clean state
npm run clean
npm ci

# 2. Build SDK
npm run build:sdk

# 3. Verify SDK output
ls -la packages/sdk/dist/
test -f packages/sdk/dist/index.js || echo "SDK build failed"
test -f packages/sdk/dist/index.d.ts || echo "SDK types missing"

# 4. Build CLI
npm run build:cli

# 5. Verify CLI output
ls -la packages/cli/dist/
test -f packages/cli/dist/main.js || echo "CLI build failed"
test -x packages/cli/dist/main.js || echo "CLI not executable"

# 6. Smoke test
node packages/cli/dist/main.js --version
```

### Integration Test

```bash
# Test SDK → CLI integration
cd packages/cli
node -e "
  const sdk = require('@sowonai/crewx-sdk');
  console.log('SDK loaded:', Object.keys(sdk));
"
```

## Troubleshooting

### Build Failures

#### TypeScript Errors

```bash
# Check TypeScript version
npx tsc --version

# Verify tsconfig
npx tsc --showConfig

# Clean and rebuild
rm -rf packages/*/dist packages/*/*.tsbuildinfo
npm run build
```

#### Module Not Found

```bash
# Check workspace links
npm ls @sowonai/crewx-sdk

# Reinstall dependencies
npm run clean
npm ci
```

#### Path Resolution Issues

```bash
# Verify paths in tsconfig
cat packages/cli/tsconfig.json | grep -A5 "paths"

# Check symlinks
ls -la node_modules/@crewx/
```

### Build Performance Issues

```bash
# Profile TypeScript compilation
npx tsc -p packages/sdk/tsconfig.json --diagnostics

# Check for large node_modules
du -sh node_modules packages/*/node_modules

# Clean caches
npm cache clean --force
rm -rf packages/*/.tsbuildinfo
```

### CI Build Failures

```bash
# Local CI simulation
npm ci --prefer-offline
npm run build
npm run test

# Check GitHub Actions logs
# - Verify Node.js version
# - Check npm cache hits
# - Review build timings
```

## Production Builds

### Optimized Build

```bash
# Set NODE_ENV
export NODE_ENV=production

# Build without dev dependencies
npm ci --production=false
npm run build

# Verify output
ls -lh packages/sdk/dist/
ls -lh packages/cli/dist/
```

### Docker Builds

Example `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY packages/sdk/package*.json ./packages/sdk/
COPY packages/cli/package*.json ./packages/cli/

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY packages/ ./packages/

# Build
RUN npm run build

# Prune dev dependencies
RUN npm ci --production

# Run
CMD ["node", "packages/cli/dist/main.js"]
```

## Build Metrics

Target metrics:

- **SDK build time**: < 10 seconds
- **CLI build time**: < 30 seconds
- **Total build time**: < 45 seconds
- **SDK bundle size**: < 500 KB
- **CLI bundle size**: < 2 MB

Monitor with:

```bash
# Time builds
time npm run build:sdk
time npm run build:cli

# Check sizes
du -sh packages/sdk/dist
du -sh packages/cli/dist
```

## Future Improvements

### Planned Optimizations

1. **esbuild/SWC**: Faster TypeScript compilation
2. **Turborepo**: Intelligent caching and parallelization
3. **Bundle analysis**: Webpack Bundle Analyzer for CLI
4. **Code splitting**: Dynamic imports for large features
5. **Tree shaking**: Better dead code elimination

### Migration Path

When ready to optimize further:

```bash
# 1. Add Turborepo
npm install -D turbo
# Configure turbo.json

# 2. Add esbuild
npm install -D esbuild
# Update build scripts

# 3. Add bundle analyzer
npm install -D webpack-bundle-analyzer
# Analyze output
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [npm Workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Turborepo](https://turbo.build/)

## Support

For build issues:
- Check GitHub Actions logs
- Review this documentation
- Open an issue with build logs
- Contact maintainers
