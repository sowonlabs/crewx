# Release Notes: v{VERSION}

**Release Date:** {YYYY-MM-DD}
**Release Type:** Major | Minor | Patch | Pre-release

---

## Highlights

<!-- Brief summary of the most important changes (2-3 sentences) -->

-

---

## What's New

### Features

<!-- List new features with brief descriptions -->

- **Feature Name:** Description (Closes #xxx)
-

### Improvements

<!-- List improvements to existing features -->

-

### Bug Fixes

<!-- List bug fixes with issue references -->

- Fixed: Description (Closes #xxx)
-

---

## Breaking Changes

<!-- Document any breaking changes and migration guidance -->

### {Breaking Change Title}

**What changed:**
<!-- Describe the change -->

**Migration guide:**
```bash
# Example migration steps
```

**Affected components:**
- [ ] CLI
- [ ] SDK
- [ ] Configuration

---

## Resolved Issues

<!-- Complete list of closed issues in this release -->

| Issue | Title | Type |
|-------|-------|------|
| #xxx | Issue title | bug/feature |

---

## Known Issues

<!-- Document any known issues that ship with this release -->

| Issue | Description | Workaround |
|-------|-------------|------------|
| #xxx | Description | Workaround steps |

---

## Deprecations

<!-- List deprecated features and removal timeline -->

| Feature | Deprecated in | Removal planned | Alternative |
|---------|---------------|-----------------|-------------|
| Feature name | This version | v{X.X.X} | Use Y instead |

---

## Dependencies

### Updated Dependencies

| Package | From | To | Notes |
|---------|------|-----|-------|
| package-name | 1.0.0 | 2.0.0 | Breaking changes |

### Security Updates

<!-- List any security-related dependency updates -->

-

---

## Upgrade Guide

### From v{PREVIOUS_VERSION}

1. Update CrewX:
   ```bash
   npm install crewx@{VERSION}
   # or
   npm install -g crewx@{VERSION}
   ```

2. Review breaking changes above

3. Test your configuration:
   ```bash
   crewx doctor
   crewx agent ls
   ```

---

## Contributors

<!-- Acknowledge contributors to this release -->

Thanks to everyone who contributed to this release!

- @username - Feature/Fix description

---

## Full Changelog

**Compare:** [v{PREVIOUS_VERSION}...v{VERSION}](https://github.com/sowonlabs/crewx/compare/v{PREVIOUS_VERSION}...v{VERSION})

---

## Verification

### Test Results

- **Build:** PASS/FAIL
- **Unit Tests:** XX/XX passed
- **Integration Tests:** XX/XX passed
- **QA Report:** [Link to QA report](../reports/releases/{VERSION}/qa-report-PASS.md)

### Compatibility

- **Node.js:** v20.x LTS
- **npm:** v10.x+
- **Platforms:** macOS, Linux, Windows

---

**Release Manager:** @{username}
**QA Lead:** @{username}
**Report Generated:** {TIMESTAMP}
