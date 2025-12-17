#!/bin/bash

# GitHub Labels Setup Script for CrewX
# Usage: ./scripts/setup-github-labels.sh
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - Repository write access
#
# This script creates standardized labels for issue and PR management.

set -e

REPO="${1:-sowonlabs/crewx}"

echo "Setting up GitHub labels for $REPO..."
echo ""

# Function to create or update a label
create_label() {
    local name="$1"
    local color="$2"
    local description="$3"

    echo "Creating label: $name"
    gh label create "$name" --color "$color" --description "$description" --repo "$REPO" 2>/dev/null || \
    gh label edit "$name" --color "$color" --description "$description" --repo "$REPO" 2>/dev/null || \
    echo "  (label already exists or error occurred)"
}

echo "=== Type Labels ==="
create_label "type:bug" "d73a4a" "Something isn't working"
create_label "type:feature" "a2eeef" "New feature or request"
create_label "type:docs" "0075ca" "Documentation improvements"
create_label "type:refactor" "fbca04" "Code refactoring without feature changes"
create_label "type:test" "bfd4f2" "Test improvements"
create_label "type:security" "b60205" "Security related issues"
create_label "type:performance" "d4c5f9" "Performance improvements"
create_label "type:maintenance" "c5def5" "Maintenance and chores"

echo ""
echo "=== Priority Labels ==="
create_label "priority:critical" "b60205" "Must be fixed immediately"
create_label "priority:high" "d93f0b" "Should be fixed soon"
create_label "priority:medium" "fbca04" "Normal priority"
create_label "priority:low" "0e8a16" "Low priority, nice to have"

echo ""
echo "=== Status Labels ==="
create_label "status:triage" "ededed" "Needs triage and assessment"
create_label "status:confirmed" "c2e0c6" "Issue confirmed and ready for work"
create_label "status:in-progress" "0052cc" "Currently being worked on"
create_label "status:blocked" "b60205" "Blocked by external dependency"
create_label "status:needs-info" "d876e3" "Needs more information from reporter"
create_label "status:wontfix" "ffffff" "This will not be worked on"
create_label "status:duplicate" "cfd3d7" "This issue already exists"

echo ""
echo "=== Component Labels ==="
create_label "component:cli" "5319e7" "CLI package (packages/cli)"
create_label "component:sdk" "1d76db" "SDK package (packages/sdk)"
create_label "component:slack" "4a154b" "Slack Bot integration"
create_label "component:mcp" "6f42c1" "MCP Server"
create_label "component:docs" "0075ca" "Documentation"
create_label "component:ci" "333333" "CI/CD and GitHub Actions"

echo ""
echo "=== Release Labels ==="
create_label "release:breaking" "b60205" "Contains breaking changes"
create_label "release:next-minor" "c5def5" "Target for next minor release"
create_label "release:next-patch" "c2e0c6" "Target for next patch release"
create_label "release:next-major" "fbca04" "Target for next major release"

echo ""
echo "=== Workflow Labels ==="
create_label "good-first-issue" "7057ff" "Good for newcomers"
create_label "help-wanted" "008672" "Extra attention is needed"
create_label "discussion" "cc317c" "Needs discussion before implementation"
create_label "rfc" "fbca04" "Request for comments on design"
create_label "needs-review" "0e8a16" "Needs code review"

echo ""
echo "=== Removing old labels (if they exist) ==="
# Remove legacy labels that conflict with new naming
gh label delete "bug" --repo "$REPO" --yes 2>/dev/null || true
gh label delete "enhancement" --repo "$REPO" --yes 2>/dev/null || true
gh label delete "documentation" --repo "$REPO" --yes 2>/dev/null || true

echo ""
echo "=== Label setup complete! ==="
echo ""
echo "Label categories:"
echo "  - type:*      - Issue/PR type classification"
echo "  - priority:*  - Priority level"
echo "  - status:*    - Current status"
echo "  - component:* - Affected component"
echo "  - release:*   - Release targeting"
echo ""
echo "Run 'gh label list --repo $REPO' to see all labels."
