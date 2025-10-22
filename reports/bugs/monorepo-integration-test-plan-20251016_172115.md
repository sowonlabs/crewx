# Monorepo Integration Test Plan

**Test Plan ID**: monorepo-integration-20251016
**Created**: 2025-10-16 17:21:15
**Target Branch**: feature/monorepo
**Test Type**: Integration Testing

## Overview

This test plan validates the monorepo migration, focusing on workspace linking, build order, dependency resolution, and SDK/CLI integration.

---

## Test Suite 1: Workspace Linking Validation

### Test Case 1.1: Verify npm Workspaces Configuration

**Objective**: Ensure npm workspaces are correctly configured and recognized

**Test Steps**:
```bash
# 1. Check workspace detection
npm query .workspace | jq -r '.[].name'

# Expected Output:
# crewx
# @sowonai/crewx-sdk

# 2. Verify workspace structure
npm ls --workspaces --depth=0

# Expected: Should list both packages without errors

# 3. Check workspace links
ls -la packages/cli/node_modules/@crewx
ls -la node_modules/@crewx

# Expected: Symlinks to packages/sdk
```

**Success Criteria**:
- ✅ npm recognizes both workspaces (crewx, @sowonai/crewx-sdk)
- ✅ Workspace list contains no errors
- ✅ Symlinks exist from CLI package to SDK package
- ✅ Root node_modules contains @crewx symlink

**Failure Scenarios**:
- ❌ npm workspace command returns no packages
- ❌ Symlinks are missing or broken
- ❌ CLI package shows SDK as external dependency

---

### Test Case 1.2: Verify workspace:* Protocol Resolution

**Objective**: Confirm that `workspace:*` dependency protocol resolves correctly

**Test Steps**:
```bash
# 1. Check CLI package.json for workspace protocol
cat packages/cli/package.json | grep -A2 '@sowonai/crewx-sdk'

# Expected Output:
# "@sowonai/crewx-sdk": "workspace:*"

# 2. Check actual resolved version after install
npm ls @sowonai/crewx-sdk --workspace=crewx

# Expected: Should show linked version, not npm registry version

# 3. Verify symlink target
readlink packages/cli/node_modules/@sowonai/crewx-sdk

# Expected: ../../sdk (relative path to SDK package)
```

**Success Criteria**:
- ✅ CLI package.json contains `"@sowonai/crewx-sdk": "workspace:*"`
- ✅ npm ls shows linked local version (not registry version)
- ✅ Symlink points to correct relative path (../../sdk)
- ✅ No duplicate @sowonai/crewx-sdk installations in node_modules

**Failure Scenarios**:
- ❌ workspace:* not found in CLI package.json
- ❌ npm installs SDK from registry instead of local link
- ❌ Multiple @sowonai/crewx-sdk versions installed

---

### Test Case 1.3: Cross-Package Import Resolution

**Objective**: Verify that CLI can import SDK modules correctly

**Test Steps**:
```bash
# 1. Check tsconfig path mapping
cat tsconfig.base.json | grep -A3 '"@sowonai/crewx-sdk"'

# Expected Output:
# "@sowonai/crewx-sdk": ["packages/sdk/src/index.ts"]

# 2. Build SDK first
npm run build:sdk

# Expected: SDK dist/ directory created with .js and .d.ts files

# 3. Create test import script
cat > /tmp/test-import.mjs << 'EOF'
import { AgentConfig } from '@sowonai/crewx-sdk';
console.log('Import successful:', typeof AgentConfig);
EOF

# 4. Test import from CLI context
cd packages/cli && node --experimental-specifier-resolution=node /tmp/test-import.mjs

# Expected Output: Import successful: object/function
```

**Success Criteria**:
- ✅ tsconfig.base.json contains correct path mapping for @sowonai/crewx-sdk
- ✅ SDK builds successfully and generates dist/ artifacts
- ✅ Test script can import SDK types/functions
- ✅ No module resolution errors

**Failure Scenarios**:
- ❌ Path mapping missing or incorrect
- ❌ SDK build fails or missing dist/ files
- ❌ Import fails with "Cannot find module" error
- ❌ TypeScript compilation errors in CLI when importing SDK

---

## Test Suite 2: Build Order Validation

### Test Case 2.1: SDK-First Build Order

**Objective**: Confirm SDK builds before CLI and CLI depends on built SDK artifacts

**Test Steps**:
```bash
# 1. Clean all build artifacts
npm run clean
rm -rf packages/sdk/dist packages/cli/dist

# 2. Verify clean state
ls packages/sdk/dist 2>&1 | grep "No such file or directory"
ls packages/cli/dist 2>&1 | grep "No such file or directory"

# 3. Build only SDK
npm run build:sdk

# 4. Check SDK artifacts
ls -la packages/sdk/dist/
# Expected: index.js, index.d.ts, and other compiled files

# 5. Build CLI (should use SDK dist)
npm run build:cli

# 6. Check CLI artifacts
ls -la packages/cli/dist/
# Expected: main.js and other CLI compiled files

# 7. Verify CLI uses compiled SDK
grep -r "@sowonai/crewx-sdk" packages/cli/dist/ | head -5
# Expected: Should reference compiled SDK code
```

**Success Criteria**:
- ✅ Clean removes all dist/ directories
- ✅ SDK builds successfully in isolation
- ✅ SDK dist/ contains .js, .d.ts, and source maps
- ✅ CLI builds successfully after SDK
- ✅ CLI references compiled SDK (not source)

**Failure Scenarios**:
- ❌ SDK build fails
- ❌ CLI build fails without SDK built first
- ❌ CLI dist/ missing or incomplete
- ❌ CLI references SDK source files instead of dist/

---

### Test Case 2.2: Parallel Workspace Build

**Objective**: Verify that `npm run build` builds all workspaces in correct order

**Test Steps**:
```bash
# 1. Clean all artifacts
npm run clean
rm -rf packages/*/dist

# 2. Run workspace-wide build
npm run build --workspaces

# Expected: Both SDK and CLI build successfully

# 3. Check build output order
# (SDK should build first due to dependency order)

# 4. Verify both packages built
ls packages/sdk/dist/index.js
ls packages/cli/dist/main.js

# Expected: Both files exist

# 5. Check for build errors
npm run build --workspaces 2>&1 | grep -i error
# Expected: No errors
```

**Success Criteria**:
- ✅ SDK builds before CLI (dependency order respected)
- ✅ Both packages build successfully
- ✅ All expected dist/ artifacts created
- ✅ No build errors or warnings

**Failure Scenarios**:
- ❌ CLI builds before SDK (wrong order)
- ❌ Build fails with dependency errors
- ❌ Missing dist/ artifacts
- ❌ Build warnings about missing types

---

### Test Case 2.3: Incremental Build Validation

**Objective**: Ensure incremental builds work correctly

**Test Steps**:
```bash
# 1. Full clean build
npm run clean
npm run build

# 2. Record build times
time npm run build:sdk > /tmp/sdk-rebuild1.log 2>&1
SDK_TIME1=$(cat /tmp/sdk-rebuild1.log | grep "real")

# 3. Modify SDK source (minor change)
echo "// Test comment" >> packages/sdk/src/index.ts

# 4. Rebuild SDK only
time npm run build:sdk > /tmp/sdk-rebuild2.log 2>&1

# 5. Rebuild CLI (should use new SDK)
npm run build:cli

# 6. Verify CLI picks up SDK changes
# (Check timestamps or content hash)

# 7. Test that CLI still works
node packages/cli/dist/main.js --help
# Expected: Help output displayed
```

**Success Criteria**:
- ✅ Incremental SDK rebuild works
- ✅ CLI rebuild picks up SDK changes
- ✅ CLI still functions correctly
- ✅ No stale module caching issues

**Failure Scenarios**:
- ❌ Incremental build fails
- ❌ CLI doesn't pick up SDK changes
- ❌ CLI runtime errors after rebuild
- ❌ TypeScript incremental cache corruption

---

## Test Suite 3: Dependency Resolution

### Test Case 3.1: Fresh Install Dependency Resolution

**Objective**: Verify npm install resolves all dependencies correctly from scratch

**Test Steps**:
```bash
# 1. Clean everything (including node_modules)
npm run clean
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules

# 2. Fresh install
npm install

# Expected: All dependencies installed, no errors

# 3. Verify workspace hoisting
ls node_modules/@nestjs/common
ls packages/cli/node_modules/@nestjs/common 2>&1
# Expected: Common deps in root, CLI-specific in packages/cli/node_modules

# 4. Verify SDK link
ls -la packages/cli/node_modules/@sowonai/crewx-sdk
# Expected: Symlink to ../../sdk

# 5. Check for duplicate dependencies
npm ls --depth=0 --all 2>&1 | grep -i "WARN"
# Expected: No warnings about duplicates
```

**Success Criteria**:
- ✅ npm install completes without errors
- ✅ All workspace dependencies hoisted to root where possible
- ✅ SDK workspace link created correctly
- ✅ No duplicate dependency warnings
- ✅ package-lock.json generated correctly

**Failure Scenarios**:
- ❌ npm install fails with resolution errors
- ❌ Missing dependencies in any package
- ❌ SDK installed from registry instead of workspace
- ❌ Duplicate dependencies causing conflicts

---

### Test Case 3.2: Peer Dependency Compatibility

**Objective**: Ensure peer dependencies are satisfied across workspace packages

**Test Steps**:
```bash
# 1. Check for peer dependency warnings
npm install 2>&1 | grep -i "WARN.*peer"

# Expected: No peer dependency warnings

# 2. Verify common dependencies versions match
npm ls typescript
npm ls @nestjs/common
npm ls @nestjs/core

# Expected: Single version of each across workspace

# 3. Check for version conflicts
npm ls 2>&1 | grep -i "UNMET"
# Expected: No unmet dependencies
```

**Success Criteria**:
- ✅ No peer dependency warnings
- ✅ Common dependencies use same version across workspace
- ✅ No unmet peer dependencies
- ✅ NestJS ecosystem packages compatible

**Failure Scenarios**:
- ❌ Peer dependency version conflicts
- ❌ Multiple versions of same package installed
- ❌ Unmet peer dependency errors

---

### Test Case 3.3: Dependency Pruning and Audit

**Objective**: Verify dependency tree is clean and secure

**Test Steps**:
```bash
# 1. Check for unused dependencies
npm exec -- depcheck packages/cli
npm exec -- depcheck packages/sdk

# Expected: No unused dependencies (or only known false positives)

# 2. Run security audit
npm audit --workspaces

# Expected: No high/critical vulnerabilities

# 3. Check for outdated packages
npm outdated --workspaces

# Expected: Document any outdated packages

# 4. Verify production bundle size
npm run build
du -sh packages/cli/dist
# Expected: Reasonable bundle size (< 50MB)
```

**Success Criteria**:
- ✅ No unused dependencies (or documented exceptions)
- ✅ No critical security vulnerabilities
- ✅ Bundle size reasonable
- ✅ Production dependencies minimal

**Failure Scenarios**:
- ❌ Unused dependencies bloating install
- ❌ Critical security vulnerabilities
- ❌ Excessive bundle size
- ❌ Dev dependencies in production bundle

---

## Test Suite 4: CLI/SDK Integration

### Test Case 4.1: SDK Type Import in CLI

**Objective**: Verify CLI correctly imports and uses SDK types

**Test Steps**:
```bash
# 1. Check CLI imports SDK types
grep -r "from '@sowonai/crewx-sdk'" packages/cli/src/ | head -10

# Expected: Multiple import statements found

# 2. Build both packages
npm run build

# 3. Verify TypeScript compilation succeeds
npm run build:cli 2>&1 | grep -i "error"
# Expected: No TypeScript errors

# 4. Check generated .d.ts files
cat packages/cli/dist/services/agent-loader.service.d.ts | grep "@sowonai/crewx-sdk"
# Expected: References to SDK types

# 5. Test runtime type checking
node packages/cli/dist/main.js query "@claude:haiku test" 2>&1 | head -20
# Expected: No type errors at runtime
```

**Success Criteria**:
- ✅ CLI source files import SDK types
- ✅ TypeScript compilation succeeds
- ✅ Generated .d.ts files reference SDK correctly
- ✅ No runtime type errors
- ✅ IDE autocomplete works (manual verification)

**Failure Scenarios**:
- ❌ TypeScript compilation errors for missing types
- ❌ Runtime errors about undefined types
- ❌ .d.ts files missing SDK references
- ❌ IDE cannot resolve SDK imports

---

### Test Case 4.2: SDK Constant/Utility Usage

**Objective**: Verify CLI uses SDK constants and utilities correctly

**Test Steps**:
```bash
# 1. Check SDK exports constants
cat packages/sdk/src/constants/index.ts
# Expected: Exported constants (DEFAULT_MODEL, etc.)

# 2. Check CLI imports SDK constants
grep -r "DEFAULT_MODEL\|ModelName\|ProviderName" packages/cli/src/ | head -10
# Expected: References to SDK constants

# 3. Build and run CLI
npm run build
node packages/cli/dist/main.js query "@claude test" --log 2>&1 | grep -i "model"
# Expected: Model info displayed (using SDK constants)

# 4. Verify utility functions work
# (Test string-utils, error-utils, etc. from SDK)
node -e "
const sdk = require('./packages/sdk/dist/index.js');
console.log('SDK exports:', Object.keys(sdk));
"
# Expected: Should list SDK exports
```

**Success Criteria**:
- ✅ SDK exports constants/utilities
- ✅ CLI imports and uses SDK exports
- ✅ CLI runtime uses SDK values correctly
- ✅ No hardcoded values duplicated between SDK/CLI

**Failure Scenarios**:
- ❌ SDK exports empty or missing
- ❌ CLI uses hardcoded values instead of SDK
- ❌ Runtime errors when using SDK utilities
- ❌ Type mismatches between SDK/CLI

---

### Test Case 4.3: End-to-End CLI Functionality

**Objective**: Verify CLI works correctly with SDK integration

**Test Steps**:
```bash
# 1. Build everything
npm run build

# 2. Test query command (uses SDK types)
node packages/cli/dist/main.js query "@claude:haiku What is 1+1?" 2>&1 | tee /tmp/cli-test-output.log

# Expected Output:
# - No errors
# - Response from Claude
# - Exit code 0

echo "Exit code: $?"

# 3. Test execute command
node packages/cli/dist/main.js execute "@claude:haiku Create test.txt with 'Hello World'" 2>&1

# Expected:
# - File created in working directory
# - No errors

ls test.txt && cat test.txt
# Expected: test.txt exists with "Hello World"

# 4. Test doctor command (checks config)
node packages/cli/dist/main.js doctor 2>&1

# Expected:
# - Shows provider status
# - No errors

# 5. Test MCP server mode
timeout 5 node packages/cli/dist/main.js mcp 2>&1 &
MCP_PID=$!
sleep 2
kill $MCP_PID 2>/dev/null
# Expected: MCP server starts without crashing
```

**Success Criteria**:
- ✅ Query command works and returns AI response
- ✅ Execute command creates files/performs actions
- ✅ Doctor command shows system status
- ✅ MCP server starts without errors
- ✅ All commands exit cleanly
- ✅ No runtime errors or crashes

**Failure Scenarios**:
- ❌ Query command fails with module errors
- ❌ Execute command doesn't work
- ❌ Doctor command crashes
- ❌ MCP server fails to start
- ❌ Runtime errors about missing SDK modules

---

### Test Case 4.4: CLI Package Publication Readiness

**Objective**: Verify CLI package can be published with correct SDK reference

**Test Steps**:
```bash
# 1. Check CLI package.json files array
cat packages/cli/package.json | grep -A10 '"files"'

# Expected: Should include dist/, not SDK source

# 2. Pack CLI for publication test
cd packages/cli
npm pack --dry-run 2>&1 | tee /tmp/pack-output.log

# Expected:
# - dist/ files included
# - SDK not bundled (workspace:* preserved in packed version)
# - Reasonable package size

# 3. Check packed dependencies
tar -tzf crewx-*.tgz 2>/dev/null | grep -i sdk
# Expected: No SDK source files, only reference

# 4. Verify publishConfig
cat packages/cli/package.json | grep -A5 'publishConfig'
# Expected: "access": "public"

# 5. Test postinstall/postbuild scripts
npm run postbuild
# Expected: Scripts run successfully
```

**Success Criteria**:
- ✅ CLI package includes only dist/ and necessary files
- ✅ SDK not bundled in CLI package
- ✅ Package size reasonable (< 10MB)
- ✅ workspace:* dependency preserved for publish
- ✅ postbuild/postinstall scripts work

**Failure Scenarios**:
- ❌ SDK source files bundled in CLI package
- ❌ Package too large (includes unnecessary files)
- ❌ workspace:* not converted for publish
- ❌ Missing critical files in package

---

## Test Suite 5: Edge Cases and Error Handling

### Test Case 5.1: Missing SDK Build

**Objective**: Verify error handling when SDK not built before CLI

**Test Steps**:
```bash
# 1. Clean SDK dist
rm -rf packages/sdk/dist

# 2. Try to build CLI without SDK
npm run build:cli 2>&1 | tee /tmp/cli-build-error.log

# Expected:
# - Should show clear error about missing SDK
# - OR should auto-build SDK first (if configured)

# 3. Check error message quality
grep -i "sdk\|dependency" /tmp/cli-build-error.log
# Expected: Helpful error message

# 4. Verify CLI doesn't build with broken state
ls packages/cli/dist/main.js 2>&1
# Expected: Either CLI built correctly OR no dist/ (clean failure)
```

**Success Criteria**:
- ✅ Clear error message when SDK not built
- ✅ OR SDK auto-builds before CLI (if configured)
- ✅ No partial/broken CLI build
- ✅ User understands how to fix the issue

**Failure Scenarios**:
- ❌ Cryptic error messages
- ❌ CLI builds but breaks at runtime
- ❌ Silent failure
- ❌ Partial build left in broken state

---

### Test Case 5.2: Symlink Broken State

**Objective**: Verify detection and recovery from broken workspace links

**Test Steps**:
```bash
# 1. Break the symlink intentionally
rm packages/cli/node_modules/@sowonai/crewx-sdk

# 2. Try to use CLI
node packages/cli/dist/main.js --help 2>&1

# Expected: Error about missing module

# 3. Run npm install to fix
npm install

# 4. Verify symlink restored
ls -la packages/cli/node_modules/@sowonai/crewx-sdk
# Expected: Symlink restored

# 5. Test CLI works again
node packages/cli/dist/main.js --help
# Expected: Works correctly
```

**Success Criteria**:
- ✅ Broken symlink detected immediately
- ✅ npm install restores symlink
- ✅ CLI recovers and works after fix
- ✅ Error message helpful

**Failure Scenarios**:
- ❌ CLI runs but crashes silently
- ❌ npm install doesn't fix symlink
- ❌ Requires manual intervention to fix
- ❌ Confusing error messages

---

### Test Case 5.3: Version Mismatch Detection

**Objective**: Verify workspace version consistency checks

**Test Steps**:
```bash
# 1. Check current versions
cat packages/cli/package.json | grep '"version"'
cat packages/sdk/package.json | grep '"version"'

# 2. Check if versions should be in sync
# (CLI: 0.3.0, SDK: 0.1.0 - may be intentional)

# 3. Verify workspace protocol doesn't lock versions
cat packages/cli/package.json | grep '@sowonai/crewx-sdk'
# Expected: "workspace:*" (not specific version)

# 4. Test that any SDK version works with CLI
# (This is the benefit of workspace:*)

# 5. Build and verify
npm run build
# Expected: Builds successfully regardless of version numbers
```

**Success Criteria**:
- ✅ workspace:* protocol used (version-agnostic)
- ✅ Build works regardless of SDK version
- ✅ No hard version locking
- ✅ Flexibility for independent versioning

**Failure Scenarios**:
- ❌ Hard-coded SDK version in CLI
- ❌ Build fails due to version mismatch
- ❌ Requires manual version sync
- ❌ workspace:* not used

---

## Test Execution Summary

### Execution Order

1. **Suite 1**: Workspace Linking (foundation)
2. **Suite 2**: Build Order (depends on Suite 1)
3. **Suite 3**: Dependency Resolution (depends on Suite 1)
4. **Suite 4**: CLI/SDK Integration (depends on Suite 1-3)
5. **Suite 5**: Edge Cases (depends on Suite 1-4)

### Execution Commands

```bash
# Quick validation (5 minutes)
npm run clean
npm install
npm run build
node packages/cli/dist/main.js --help
node packages/cli/dist/main.js query "@claude:haiku test"

# Full test suite (30 minutes)
# Run all test cases in order from Suite 1-5
# Document results in test report

# Automated regression test (future)
# Create npm script: npm run test:monorepo
```

### Exit Criteria

**All tests must pass before merging feature/monorepo:**

- ✅ All 18 test cases PASS
- ✅ No critical failures in any suite
- ✅ CLI functional end-to-end
- ✅ Documentation updated
- ✅ No security vulnerabilities
- ✅ Build time acceptable (< 2 minutes)
- ✅ Package size reasonable (< 10MB)

### Known Limitations

1. **Manual Testing Required**:
   - IDE autocomplete verification (Test 4.1)
   - Error message clarity assessment (Test 5.1, 5.2)
   - Developer experience evaluation

2. **Performance Benchmarks**:
   - Build time baseline: TBD
   - Install time baseline: TBD
   - Runtime performance: TBD (should match pre-monorepo)

3. **Future Enhancements**:
   - Automated CI/CD integration
   - Performance regression tests
   - Cross-platform testing (Windows, Linux)
   - Docker environment testing

---

## Appendix A: Troubleshooting Guide

### Common Issues

**Issue 1: "Cannot find module '@sowonai/crewx-sdk'"**
- **Cause**: Symlink not created or broken
- **Fix**: `npm install` or `npm run clean && npm install`

**Issue 2: "TypeScript error: Cannot find type definitions"**
- **Cause**: SDK not built before CLI
- **Fix**: `npm run build:sdk` then `npm run build:cli`

**Issue 3: "npm WARN peer dep missing"**
- **Cause**: Peer dependency version mismatch
- **Fix**: Check package.json versions, align if needed

**Issue 4: "ENOENT: no such file or directory, scandir 'dist'"**
- **Cause**: Build artifacts missing
- **Fix**: `npm run build`

### Validation Commands

```bash
# Quick health check
npm run doctor  # (if available)
npm ls --workspaces --depth=0
npm run build --workspaces

# Reset to clean state
npm run clean
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
npm run build

# Verify CLI works
node packages/cli/dist/main.js --version
node packages/cli/dist/main.js doctor
```

---

## Appendix B: Test Data and Fixtures

### Test Agent Configurations

```yaml
# Test crewx.yaml for integration tests
agents:
  claude_haiku:
    provider: claude
    model: claude-3-haiku
    mode: execute

  test_agent:
    provider: claude
    model: claude-3-5-sonnet
    mode: query
```

### Expected File Sizes

```bash
packages/sdk/dist/         ~100KB
packages/cli/dist/         ~5MB
node_modules/              ~500MB (after install)
crewx-*.tgz (packed)      ~2-3MB
```

### Test Environment Requirements

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **OS**: macOS (primary), Linux (secondary)
- **Disk Space**: ~1GB for full build
- **Network**: Required for fresh install tests

---

## Sign-off

**Test Plan Author**: @crewx_tester
**Reviewed By**: TBD
**Approved By**: TBD
**Date**: 2025-10-16

**Notes**: This test plan will be executed after monorepo migration (WBS-3) is complete. Results will be documented in a separate test report.
