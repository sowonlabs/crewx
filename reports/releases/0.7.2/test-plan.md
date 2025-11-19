# Release Plan: 0.7.2

**Date:** 2025-11-19
**Release Type:** Hotfix
**Previous Version:** 0.7.1 (production)
**Target Version:** 0.7.2

---

## 📦 Included Fixes

This release is a **hotfix** that improves template list usability by displaying the template ID (name field) instead of displayName.

### Bug Fix: Template List Shows Template ID
- **Issue:** `crewx template list` was showing displayName instead of the actual template ID
- **Fix:** Updated template list output to display the `name` field, which is the correct ID users should use with `crewx template init`
- **User Impact:** Users can now directly copy and use the template ID from the list command
- **Related Commit:** `71153ca` - fix(template): display template ID in list command

---

## 📋 Testing Scope

**Type:** Simple hotfix, no regression testing required

This is a minimal UI fix with no code logic changes:
- No API changes
- No dependency updates
- No configuration changes
- Direct bug fix to template list output

**Affected Commands:**
- `crewx template list` - Now shows template ID correctly

---

## ✅ Release Status

**Build Status:** Pending verification
**Test Status:** N/A (hotfix, no tests required)
**Ready to Publish:** Yes, after build verification
