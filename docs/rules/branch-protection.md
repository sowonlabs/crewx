# Branch Protection Rule

## 🚨 CRITICAL: NEVER Change Main Directory Branch 🚨

**ABSOLUTE RULE:** Main directory (`/Users/doha/git/crewx`) MUST ALWAYS stay on `develop` branch

## Why This Matters

Changing the branch in the main directory causes workflow confusion between agents:
- Release Manager reads wrong code state
- QA tests wrong branch
- Other agents get lost in wrong context
- Entire release process fails

## Rules

1. **When working in worktree**: Use ABSOLUTE paths, stay in worktree directory
2. **After worktree work**: MUST run `cd /Users/doha/git/crewx && git checkout develop`
3. **For temporary checks**: Always return to develop after `(cd /path && command)`
4. **If you change directory**: ALWAYS verify with `pwd` and restore location

## Examples

### ❌ BAD
```bash
cd worktree/bugfix-xxx
# (work)
# (forget to return) ← PROBLEM!
```

### ✅ GOOD
```bash
cd worktree/bugfix-xxx && (work) && cd /Users/doha/git/crewx && git checkout develop
```

## Critical Rule
After ANY worktree operation, MUST run:
```bash
cd /Users/doha/git/crewx && git checkout develop
```
