# Test Report Directory Structure

## Directory Layout

```
reports/
├── releases/{version}/     # RC release test reports
│   ├── rc.0-test-report.md
│   ├── phase1-feature-{timestamp}.md
│   ├── qa-report-PASS.md (or FAIL.md)
│   └── test-plan.md
├── bugs/                   # Individual bug test reports
│   ├── bug-{hash}-test-{timestamp}.md
│   └── qa-bug-{hash}-PASS.md
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

### Individual Bug Tests
- **Location**: `/Users/doha/git/crewx/reports/bugs/`
- **Format**: `bug-{hash}-test-{timestamp}.md`
- **Example**: `bugs/bug-aae5d66-test-20251004_171500.md`
- **Note**: {hash} is 7-character git-bug hash (e.g., aae5d66, d5670a2)

### QA Bug Reports
- **Location**: `/Users/doha/git/crewx/reports/bugs/`
- **Format**: `qa-bug-{hash}-{PASS|FAIL}.md`
- **Example**: `bugs/qa-bug-aae5d66-PASS.md`

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
3. **Include version or bug hash in filename** for easy identification
4. **Timestamp format**: `yyyyMMdd_hhmmss`

## Examples

### Creating RC Release Test Report
```bash
mkdir -p /Users/doha/git/crewx/reports/releases/0.3.14-rc.0
# Write tool: /Users/doha/git/crewx/reports/releases/0.3.14-rc.0/phase2-background-tasks-20251007_140000.md
```

### Creating Individual Bug Test Report
```bash
mkdir -p /Users/doha/git/crewx/reports/bugs
# Write tool: /Users/doha/git/crewx/reports/bugs/bug-aae5d66-test-20251004_171500.md
```
