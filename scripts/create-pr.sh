#!/bin/bash
# PR 자동 생성 스크립트
# Usage: ./scripts/create-pr.sh <issue-number> <target-branch>
# Example: ./scripts/create-pr.sh 12 release/0.7.8

set -e

ISSUE_NUMBER=$1
TARGET_BRANCH=${2:-develop}

if [ -z "$ISSUE_NUMBER" ]; then
  echo "❌ Error: Issue number required"
  echo "Usage: $0 <issue-number> [target-branch]"
  echo "Example: $0 12 release/0.7.8"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Validate we're on a feature branch
if [[ ! "$CURRENT_BRANCH" =~ ^feature/ ]]; then
  echo "❌ Error: Not on a feature branch"
  echo "Current branch: $CURRENT_BRANCH"
  echo "Expected: feature/<issue-number>-<description>"
  exit 1
fi

# Extract issue number from branch name
BRANCH_ISSUE=$(echo "$CURRENT_BRANCH" | sed -E 's/feature\/([0-9]+)-.*/\1/')

if [ "$BRANCH_ISSUE" != "$ISSUE_NUMBER" ]; then
  echo "⚠️  Warning: Branch issue ($BRANCH_ISSUE) != provided issue ($ISSUE_NUMBER)"
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Get issue details from GitHub
echo "📋 Fetching issue #$ISSUE_NUMBER details..."
ISSUE_TITLE=$(gh issue view "$ISSUE_NUMBER" --json title --jq .title)
ISSUE_LABELS=$(gh issue view "$ISSUE_NUMBER" --json labels --jq '[.labels[].name] | join(", ")')

# Determine reviewer based on worker
WORKER_LABEL=$(echo "$ISSUE_LABELS" | grep -oE 'worker:[a-z_]+' || echo "")
if [[ "$WORKER_LABEL" =~ worker:crewx_claude_dev ]]; then
  REVIEWER="crewx_gemini_dev"
elif [[ "$WORKER_LABEL" =~ worker:crewx_gemini_dev ]]; then
  REVIEWER="crewx_claude_dev"
elif [[ "$WORKER_LABEL" =~ worker:crewx_codex_dev ]]; then
  REVIEWER="crewx_claude_dev"
else
  REVIEWER="crewx_claude_dev"
fi

# Create PR body
PR_BODY="## Issue
Fixes #$ISSUE_NUMBER

## Summary
$ISSUE_TITLE

## Changes
- List your changes here

## Test Plan
- [ ] Automated tests pass
- [ ] Manual testing completed
- [ ] No breaking changes

## Review Checklist
- [ ] Logic errors checked
- [ ] Security vulnerabilities checked
- [ ] Performance impact considered
- [ ] Error handling verified

---
🤖 Auto-generated PR - Review by @$REVIEWER
"

# Push current branch
echo "🚀 Pushing $CURRENT_BRANCH to origin..."
git push -u origin "$CURRENT_BRANCH"

# Create PR
echo "📝 Creating PR to $TARGET_BRANCH..."
PR_URL=$(gh pr create \
  --title "$(echo "$ISSUE_TITLE" | sed 's/\[Bug\]: //; s/\[Feature\]: //')" \
  --body "$PR_BODY" \
  --base "$TARGET_BRANCH" \
  --head "$CURRENT_BRANCH")

echo "✅ PR created: $PR_URL"

# Add reviewer label to issue
echo "🏷️  Adding reviewer label to issue..."
gh issue edit "$ISSUE_NUMBER" --add-label "reviewer:$REVIEWER"

# Add comment to issue
echo "💬 Adding PR link to issue..."
gh issue comment "$ISSUE_NUMBER" --body "🔗 PR created: $PR_URL

Assigned reviewer: @$REVIEWER

**Next steps:**
1. @$REVIEWER will review for critical issues
2. After approval, merge to $TARGET_BRANCH"

echo ""
echo "🎉 Done! PR workflow initiated for issue #$ISSUE_NUMBER"
echo "PR: $PR_URL"
echo "Reviewer: @$REVIEWER"
