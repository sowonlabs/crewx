# Git-Bug Command Reference for CrewX

## Overview
git-bug is our primary bug tracking system.

## Core Commands

### Listing Bugs
```bash
# List all bugs
git bug bug

# List open bugs only
git bug bug --status open

# List closed bugs only
git bug bug --status closed

# Filter by label (RECOMMENDED for finding specific bugs)
git bug bug -l status:resolved      # Find resolved bugs
git bug bug -l priority:높음         # Find high priority bugs
git bug bug -l version:0.1.17       # Find bugs for specific version

# Search bugs by text
git bug bug "keyword"
```

### Viewing Bug Details
```bash
# Show full bug details
git bug bug show BUG_HASH

# Show bug title
git bug bug title BUG_HASH

# Show bug comments
git bug bug comment BUG_HASH
```

### Creating Bugs
```bash
# Create new bug (interactive)
git bug bug new

# Create bug with title and message (non-interactive)
git bug bug new --title "Bug title" --message "Description"
```

### Updating Bug Status
```bash
# Close a bug
git bug bug status close BUG_HASH

# Reopen a bug
git bug bug status open BUG_HASH
```

### Managing Labels
```bash
# Add labels to bug
git bug bug label new BUG_HASH label1 label2

# Remove labels
git bug bug label rm BUG_HASH label1

# View bug labels
git bug bug label BUG_HASH
```

### Adding Comments
```bash
# Add comment to bug
git bug bug comment new BUG_HASH --message "Comment text"

# Edit existing comment
git bug bug comment edit COMMENT_ID --message "Updated text"
```

## CrewX Bug Workflow

### Standard Labels
- **status:** created, analyzed, in-progress, resolved, rejected, closed
- **priority:** 높음 (high), 중간 (medium), 낮음 (low)
- **version:** 0.1.x (version where bug found/fixed)
- **target_release:** 0.1.x (planned release version for this bug)

### How to Determine Correct Version

**ALWAYS check npm registry before setting version labels:**

```bash
# Check current production version
npm view crewx version
# Output example: 0.1.0

# Use the major.minor version for labels
# If production is 0.1.0 → use 0.1.x for version/target_release
```

**Version Label Rules:**
- `version:X.Y.x` - Version where bug was found/fixed
- `target_release:X.Y.x` - Planned release for this bug
- Always use current major.minor (e.g., 0.1.x, not 0.3.x)
- Update labels if version changes between bug creation and release

**Example:**
```bash
# Step 1: Check production version
npm view crewx version  # → 0.1.0

# Step 2: Register bug with correct version
git bug bug new --title "Bug title" --message "Description"
BUG_HASH=$(git bug bug | head -1 | awk '{print $1}')
git bug bug label new $BUG_HASH status:created priority:중간 version:0.1.x target_release:0.1.x
```

### Bug States
1. **created** → Bug reported, not analyzed
2. **analyzed** → Root cause identified
3. **in-progress** → Developer working on fix
4. **resolved** → Fix implemented, ready for testing
5. **closed** → Verified working, released
6. **rejected** → Won't fix (duplicate, invalid, etc.)

## Common Workflows

### Find bugs by status
```bash
# Find all resolved bugs (ready for RC)
git bug bug | grep 'status:resolved'

# Find bugs in specific version
git bug bug | grep 'version:0.1.13'
```

### Get bug details for testing
```bash
# Show bug details by hash
git bug bug show aae5d66
```

### Update bug status after fix
```bash
# Add in-progress label
git bug bug label new $HASH status:in-progress

# Remove created label
git bug bug label rm $HASH status:created

# Add comment with resolution
git bug bug comment new $HASH --message "Fixed in commit abc123"

# Mark as resolved
git bug bug label rm $HASH status:in-progress
git bug bug label new $HASH status:resolved
```

## Agent Usage Tips

### For Developers (@crewx_dev)
- Use `git bug bug --status open` to find bugs to fix
- Update status: created → in-progress → resolved
- Add comments with fix details
- Never set status:closed (only users can close)

### For QA (@crewx_qa_lead, @crewx_tester)
- List resolved bugs: `git bug bug -l status:resolved`
- Get bug details for test planning: `git bug bug show HASH`
- Verify labels match expected version

### For Release Manager (@crewx_release_manager)
- Find bugs for RC: `git bug bug -l status:resolved`
- Parse bug hashes for merging
- Verify bug fixes in RC branch before release

## Output Format

### Default Format (git bug bug)
```
HASH    STATUS  TITLE
b31d1c9 open    Fix default agent config loading
6cfd309 closed  Update crewx.yaml filename handling
...
```

- First column: git-bug hash (7 chars)
- Second column: **Bug state** (open/closed) - NOT label status!
- Third column: Bug title

**🚨 CRITICAL: Labels are NOT shown in default output!**

The second column shows bug **state** (open/closed), not label **status** (created/resolved/etc).

### When Using -l Flag (Filter by Label)
```bash
git bug bug -l status:resolved
```
**Output:**
```
aae5d66  open   Change license from MIT to AGPL-3.0
d5670a2  open   agents.yaml 기본 파일명을 crewx.yaml로 변경
```

**⚠️ Confusing but correct:**
- Second column says "open" (bug state)
- But these bugs have `status:resolved` label (that's why -l found them!)
- Labels are NOT displayed in default format

**How to verify labels:**
```bash
# Method 1: Use show command
git bug bug show aae5d66

# Method 2: Use json format
git bug bug -l status:resolved -f json | grep labels
```

## Common Mistakes and Solutions

### Wrong Hash Format
❌ **Wrong:** Using bug-ID prefix with hash
```bash
git bug bug show bug-aae5d66  # ERROR: Invalid hash
git bug bug label new bug-aae5d66 status:resolved  # ERROR
```

✅ **Correct:** Use only the 7-character hash
```bash
git bug bug show aae5d66  # Correct
git bug bug label new aae5d66 status:resolved  # Correct
```

**Why?** git-bug uses its own hash system (e.g., `aae5d66`). Never add `bug-` prefix to the hash.

### Finding Resolved Bugs
❌ **Wrong:** Using grep on bug list doesn't show labels
```bash
git bug bug | grep 'status:resolved'  # Won't work - labels not shown in list
```

✅ **Correct:** Use `-l` flag to filter by label (RECOMMENDED)
```bash
git bug bug -l status:resolved  # Fast and accurate!
```

✅ **Alternative:** Use `git bug bug show` to check individual bugs
```bash
# Get bug hash from list, then show details
git bug bug show aae5d66
```

### Bug List Command
❌ **Wrong:** Using non-existent `ls` subcommand
```bash
git bug bug ls  # ERROR: Unknown command 'ls'
```

✅ **Correct:** Use `git bug bug` without subcommand
```bash
git bug bug  # Lists all bugs
git bug bug --status open  # Lists open bugs
```

### Confusing: "open" State vs "resolved" Label
❌ **Wrong interpretation:** "Output says 'open', so it's not resolved"
```bash
git bug bug -l status:resolved
# Output:
# aae5d66  open   Bug title...
#
# Conclusion: "It says open, so no resolved bugs" ❌ WRONG!
```

✅ **Correct interpretation:** "-l filtered by label, output shows state"
```bash
git bug bug -l status:resolved
# Output shows bugs WITH status:resolved label
# Second column "open" = bug STATE (not closed to develop yet)
# These bugs ARE resolved and ready for RC testing!
```

**Key Understanding:**
- **Bug State** (open/closed): Managed by Release Manager after merge to develop
- **Bug Label** (status:resolved): Managed by Developer after fixing
- `-l status:resolved` finds bugs with the **label**, regardless of **state**
- "open" state + "status:resolved" label = **Ready for RC testing**

## Efficient Bug Query Methods

### Finding Bugs by Label (RECOMMENDED)
Use the `-l` flag for fast and accurate label-based searches:

```bash
# Find all resolved bugs (ready for RC)
git bug bug -l status:resolved

# Find high priority bugs
git bug bug -l priority:높음

# Find bugs for specific version
git bug bug -l version:0.1.17

# Combine with status filter
git bug bug --status open -l priority:높음
```

**Why use `-l` instead of grep?**
- ✅ Faster: Direct label query
- ✅ Accurate: No false positives
- ✅ Clean: Only bugs with exact label match

### Finding a Specific Bug by Hash
```bash
# Quick search by hash in bug list
git bug bug | grep 'aae5d66'

# Get full details
git bug bug show aae5d66
```

### Checking Multiple Bugs
When you need to check status of multiple bugs, run individual show commands:

```bash
# Check bug aae5d66
git bug bug show aae5d66

# Check bug b31d1c9
git bug bug show b31d1c9

# Check bug 6cfd309
git bug bug show 6cfd309
```

**Why individual commands?**
- `git bug bug` list output doesn't include labels (status, priority, version)
- Labels are only visible in `git bug bug show HASH` output
- grep on list output can't find status:resolved or other labels

### Finding Bugs for RC Release
```bash
# RECOMMENDED: Use -l flag to find bugs by target_release
git bug bug -l target_release:0.1.17

# Find resolved bugs for specific release
git bug bug -l status:resolved -l target_release:0.1.17

# Find all resolved bugs (any release)
git bug bug -l status:resolved

# Alternative: Manual checking (slower)
# Step 1: List all open bugs
git bug bug --status open

# Step 2: Check each bug individually for status:resolved label
git bug bug show HASH1
git bug bug show HASH2
# ... repeat for each bug

# Step 3: Collect hashes with status:resolved for merging
```

## Important Notes
- **Hash is primary identifier** in git-bug (7-character format like `aae5d66`)
- Status in git-bug: only "open" or "closed" (labels track detailed states)
- **Labels are not visible in list output** - use `show` command or `-l` flag to filter by labels
