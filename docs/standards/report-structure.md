# Test Report Directory Structure

## Directory Layout

```
reports/
├── releases/{version}/     # RC release test reports
│   ├── rc.0-test-report.md
│   ├── phase1-feature-{timestamp}.md
│   ├── qa-report-PASS.md (or FAIL.md)
│   └── test-plan.md
├── bugs/                   # Individual issue test reports
│   ├── issue-{number}-test-{timestamp}.md
│   └── qa-issue-{number}-{PASS|FAIL}.md
└── research/               # Analysis and research documents
    └── analysis-{topic}-{timestamp}.md
```

## File Naming Conventions

### RC Release Tests
- **Location**: `/Users/doha/git/crewx/reports/releases/{version}/`
- **Format**:
  - Test reports: `phase{N}-{name}-{timestamp}.md`
  - QA reports: `qa-report-{PASS|FAIL}.md`
  - Test plans: `test-plan.md`
- **Example**: `releases/0.3.14-rc.0/phase2-background-tasks-20251007_140000.md`

### Individual Issue Tests
- **Location**: `/Users/doha/git/crewx/reports/bugs/`
- **Format**: `issue-{number}-test-{timestamp}.md`
- **Example**: `bugs/issue-42-test-20251204_171500.md`
- **Note**: {number} is the GitHub issue number

### QA Issue Reports
- **Location**: `/Users/doha/git/crewx/reports/bugs/`
- **Format**: `qa-issue-{number}-{PASS|FAIL}.md`
- **Example**: `bugs/qa-issue-42-PASS.md`

### General Tests
- **Location**: `/Users/doha/git/crewx/reports/bugs/`
- **Format**: `report-{timestamp}.md`
- **Example**: `bugs/report-20251004_171500.md`

## Important Rules

1. **Always use ABSOLUTE paths**, NOT relative paths
2. **Create directory if it doesn't exist**:
   ```bash
   mkdir -p /Users/doha/git/crewx/reports/releases/{version}
   ```
3. **Include version or issue number in filename** for easy identification
4. **Timestamp format**: `yyyyMMdd_hhmmss`

## Examples

### Creating RC Release Test Report
```bash
mkdir -p /Users/doha/git/crewx/reports/releases/0.3.14-rc.0
# Write tool: /Users/doha/git/crewx/reports/releases/0.3.14-rc.0/phase2-background-tasks-20251007_140000.md
```

### Creating Individual Issue Test Report
```bash
mkdir -p /Users/doha/git/crewx/reports/bugs
# Write tool: /Users/doha/git/crewx/reports/bugs/issue-42-test-20251204_171500.md
```
