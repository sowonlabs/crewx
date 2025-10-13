# Release Plan: 0.2.0

**Date Created:** 2025-10-11
**Plan Type:** Major Feature Release
**Current Production Version:** 0.1.3
**Target Version:** 0.2.0

---

## 📦 Included Bugs/Features

### Feature: Namespace-Based Provider System
- **bug-5aebbf0**: [feature] Implement namespace-based provider system with plugin support
  - **Labels:** priority:high, status:resolved, target_release:0.2.0, type:feature
  - **Branch:** feature/provider-yaml-plugin
  - **Status:** ✅ Resolved and tested

---

## 🧪 Test Report Location

### Existing Test Reports
- **Feature Test (Individual):** `reports/bugs/namespace-provider-test-20251011_213600.md`
  - **Date:** 2025-10-11
  - **Result:** ✅ PASS
  - **Tester:** @crewx_tester

### Planned Test Reports
- **RC Test Reports:** `reports/releases/0.2.0/rc.0-test-report.md`
- **QA Reports:** `reports/releases/0.2.0/qa-report-{PASS|FAIL}.md`
- **Integration Tests:** `reports/releases/0.2.0/phase1-integration-{timestamp}.md`

---

## 📋 Testing Scope

### ✅ TESTED (Already Passed)
- **bug-5aebbf0**: Namespace provider system
  - Query mode with plugin/mock provider ✅
  - Execute mode with plugin/mock provider ✅
  - Model substitution (sonnet → opus) ✅
  - Provider name display format (plugin/mock) ✅
  - Namespace format parsing (@mock_test:model) ✅

### 🔄 RETEST Required (RC Integration)
- **bug-5aebbf0**: Integration testing in RC branch
  - Verify backward compatibility
  - Test migration path from 0.1.x config format
  - Validate breaking changes documentation
  - Cross-provider compatibility (if CLI providers available)

### 🚫 SKIP
- None (only one feature in this release)

---

## 🎯 Success Criteria

### Functional Requirements
1. ✅ All plugin provider tests pass
2. ⚠️ Breaking changes clearly documented
3. ⚠️ Migration guide available for users
4. ⚠️ Backward compatibility verified (or exceptions documented)

### Quality Requirements
1. ✅ No regression in existing CLI provider functionality
2. ⚠️ Performance benchmarks maintained
3. ⚠️ Configuration validation working correctly
4. ⚠️ Error messages clear and helpful

### Documentation Requirements
1. ⚠️ Updated README with namespace format examples
2. ⚠️ CHANGELOG.md updated with breaking changes
3. ⚠️ crewx.example.yaml updated
4. ⚠️ Migration guide from 0.1.x to 0.2.0

---

## 🔍 Test History Analysis

### Previous RC Results
- **0.1.1-rc.0**: Limited test reports available
- **0.1.1-rc.1**: Limited test reports available
- **0.1.3**: Currently in production (npm registry)

### Current Test Context
- **NEW feature**: Namespace-based provider system
- **Individual test**: ✅ PASSED on 2025-10-11
- **RC integration test**: NOT YET PERFORMED
- **Production deployment**: NOT YET PERFORMED

---

## ⚠️ Breaking Changes

### Provider Configuration Format
**OLD (0.1.x):**
```yaml
agents:
  - id: "my_agent"
    provider: "claude"  # Simple ID
```

**NEW (0.2.0):**
```yaml
agents:
  - id: "my_agent"
    provider: "cli/claude"  # Namespace required
```

### Migration Required
Users upgrading from 0.1.x to 0.2.0 MUST update their configuration files:
- `provider: "claude"` → `provider: "cli/claude"`
- `provider: "gemini"` → `provider: "cli/gemini"`
- `provider: "copilot"` → `provider: "cli/copilot"`

### Validation Changes
ConfigValidatorService now validates namespace format. Invalid provider references will cause errors.

---

## 📈 Release Strategy

### Phase 1: RC Preparation (Current)
- [x] Feature development complete
- [x] Individual feature testing complete
- [ ] Create RC branch: `release/0.2.0-rc.0`
- [ ] Run integration tests
- [ ] Document breaking changes
- [ ] Create migration guide

### Phase 2: RC Testing
- [ ] Deploy RC to test environment
- [ ] Run full test suite in RC branch
- [ ] Validate breaking changes
- [ ] Test migration path
- [ ] Performance testing

### Phase 3: Production Release
- [ ] Merge RC to develop
- [ ] Update version to 0.2.0
- [ ] Publish to npm
- [ ] Create git tag v0.2.0
- [ ] Update documentation

---

## 🚨 Risk Assessment

### High Risk Items
1. **Breaking Changes**: Provider format change may break existing user configs
   - **Mitigation**: Clear migration guide + validation errors with helpful messages

2. **Backward Compatibility**: Existing 0.1.x users need migration
   - **Mitigation**: Document upgrade path + provide examples

### Medium Risk Items
1. **Plugin Provider Stability**: New plugin system needs production validation
   - **Mitigation**: Comprehensive testing with various plugin configurations

2. **CLI Provider Compatibility**: Namespace change affects all providers
   - **Mitigation**: Test with real Claude/Gemini/Copilot CLI tools if available

### Low Risk Items
1. **Performance Impact**: Namespace parsing overhead minimal
2. **Documentation**: Well-documented feature with examples

---

## 📊 Version Justification

### Why 0.2.0 (Minor Version Bump)?
- **Breaking Changes**: Provider configuration format changed
- **New Feature**: Plugin provider system (significant new capability)
- **API Changes**: Provider factory and validation logic modified
- **Semver Compliance**: Breaking changes = minor version bump (0.x series)

### Not 0.1.4 because:
- Breaking changes require more than patch version
- New architecture (namespace system) is substantial

### Not 1.0.0 because:
- Still in 0.x development phase
- May have additional breaking changes before stable 1.0

---

## 🎯 Success Metrics

### Pre-Release Checklist
- [ ] All tests pass in RC branch
- [ ] Breaking changes documented
- [ ] Migration guide created
- [ ] Example configurations updated
- [ ] Performance benchmarks verified

### Post-Release Checklist
- [ ] npm package published successfully
- [ ] Git tag created (v0.2.0)
- [ ] Documentation deployed
- [ ] User migration support ready

---

## 👥 Stakeholder Communication

### Development Team
- **Status**: Feature complete, testing in progress
- **Action Required**: Review breaking changes and migration guide

### QA Team
- **Status**: Individual test passed, RC integration pending
- **Action Required**: Prepare RC test plan

### Release Manager
- **Status**: Awaiting RC test results
- **Action Required**: Prepare for 0.2.0-rc.0 branch creation

### End Users
- **Status**: Not yet informed
- **Action Required**: Announce breaking changes after RC approval

---

## 📅 Timeline Estimate

**Optimistic Path (RC passes first time):**
- RC Creation: 1 day
- RC Testing: 2-3 days
- Production Release: 1 day
- **Total: 4-5 days**

**Realistic Path (RC iterations):**
- RC Creation: 1 day
- RC Testing + Fixes: 5-7 days
- Production Release: 1 day
- **Total: 7-9 days**

---

## 🔗 Related Documentation

- Test Report: `/Users/doha/git/crewx/reports/bugs/namespace-provider-test-20251011_213600.md`
- Feature Branch: `feature/provider-yaml-plugin`
- Bug Tracker: `git bug bug show 5aebbf0`
- Example Config: `crewx.example.yaml`

---

## Next Steps

1. **QA Team Lead** (@crewx_qa_lead):
   - Review this release plan
   - Create RC test plan with focus on breaking changes
   - Coordinate with @crewx_tester for RC integration testing

2. **Development Team Lead** (@crewx_dev):
   - Review breaking changes
   - Prepare migration guide documentation
   - Update CHANGELOG.md

3. **Release Manager** (@crewx_release_manager):
   - Create `release/0.2.0-rc.0` branch when ready
   - Merge bug-5aebbf0 feature branch
   - Coordinate RC testing

---

**Plan Status:** 📝 DRAFT
**Approval Status:** ⏳ PENDING QA REVIEW
**Last Updated:** 2025-10-11
