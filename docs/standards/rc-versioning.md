# RC Versioning Standard

## Golden Rule

**ALWAYS start from rc.0**

## Versioning Convention

### First RC Release
- ✅ Correct: `0.3.14-rc.0`
- ❌ Wrong: `0.3.14-rc.1` (never start with rc.1)

### Subsequent RC Releases (after test failure)
- First RC fails → `0.3.14-rc.1`
- Second RC fails → `0.3.14-rc.2`
- Third RC fails → `0.3.14-rc.3`
- ... and so on

## Examples

### Scenario 1: Success on First RC
```
0.3.14-rc.0 → Test → ✅ PASS → Merge to develop
```

### Scenario 2: First RC Fails
```
0.3.14-rc.0 → Test → ❌ FAIL (bug aae5d66)
  → Exclude bug aae5d66
  → 0.3.14-rc.1 → Test → ✅ PASS → Merge to develop
```

### Scenario 3: Multiple Failures
```
0.3.14-rc.0 → ❌ FAIL (bug aae5d66, bug c8b3f1d)
  → Exclude both
  → 0.3.14-rc.1 → ❌ FAIL (bug d5670a2)
    → Exclude bug d5670a2
    → 0.3.14-rc.2 → ✅ PASS → Merge to develop
```

## Branch Naming

- RC branch: `release/{version}-rc.{N}`
- Examples:
  - `release/0.3.14-rc.0`
  - `release/0.3.14-rc.1`
  - `release/0.3.14-rc.2`

## Common Mistakes

❌ **DON'T:**
- Start with rc.1 (should be rc.0)
- Skip rc numbers (rc.0 → rc.2)
- Use different versioning schemes

✅ **DO:**
- Always start with rc.0
- Increment sequentially (rc.0 → rc.1 → rc.2)
- Use consistent naming across all tools and agents

## NPM Tag Convention

### RC Versions → `next` tag
```bash
# RC versions (e.g., 0.7.8-rc.0, 0.7.8-rc.1) use 'next' tag
npm publish --tag next --access public
```

### Stable Versions → `latest` tag (default)
```bash
# Stable versions (e.g., 0.7.8, 1.0.0) use 'latest' tag (default)
npm publish --access public
```

### Important Rules
- ✅ RC versions: Always use `--tag next`
- ✅ Stable versions: Use default tag (which is `latest`)
- ❌ Never use `--tag rc` (not a standard npm tag)

### Why 'next' instead of 'rc'?
- `next` is a well-established npm convention for pre-release versions
- Users can install RC versions with `npm install crewx@next`
- Prevents accidental installation of RC versions by default (`npm install crewx` gets latest stable)
