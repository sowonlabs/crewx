# Release 0.7.8 Final Release Checklist

**Date:** 2025-12-18
**RC Version:** 0.7.8-rc.15
**Target:** 0.7.8 (Final)

---

## Pre-Release Verification

- [ ] **Smoke Test 완료**
  - [ ] `npm i -g crewx@next` 설치 테스트
  - [ ] `crewx --version` → 0.7.8-rc.15 확인
  - [ ] `crewx help` → 버전 정상 표시 확인
  - [ ] `crewx doctor` 실행 확인
  - [ ] Node 20.18.x에서 설치 시 engines 경고 확인

---

## Release Steps (Workflow 4)

### 1. Version Update

```bash
# Navigate to release branch
cd /Users/doha/git/crewx
git checkout release/0.7.8

# Update all package versions (rc.15 → final)
# root package.json
sed -i '' 's/"version": "0.7.8-rc.15"/"version": "0.7.8"/g' package.json

# packages/sdk/package.json
sed -i '' 's/"version": "0.7.8-rc.15"/"version": "0.7.8"/' packages/sdk/package.json

# packages/cli/package.json
sed -i '' 's/"version": "0.7.8-rc.15"/"version": "0.7.8"/' packages/cli/package.json
sed -i '' 's/"@sowonai\/crewx-sdk": "\^0.7.8-rc.15"/"@sowonai\/crewx-sdk": "^0.7.8"/' packages/cli/package.json

# packages/crewx/package.json
sed -i '' 's/"version": "0.7.8-rc.15"/"version": "0.7.8"/' packages/crewx/package.json
sed -i '' 's/"@sowonai\/crewx-cli": "\^0.7.8-rc.15"/"@sowonai\/crewx-cli": "^0.7.8"/' packages/crewx/package.json
```

### 2. Commit Version

```bash
git add package.json packages/*/package.json
git commit -m "$(cat <<'EOF'
chore: release 0.7.8 - Slack thread handling & Node version requirement

Bug Fixes:
- #14, #15, #16: Slack Active Speaker model (thread response control)
- #22: CLI/Codex provider thread context fix
- #25: CLI --thread conversation_history fix
- #28: Increase log truncation limits (10x)

Improvements:
- Node.js >= 20.19.0 requirement (ESM compatibility)
- Help version display fix
- UTF-8 cross-platform encoding (#18)
- Branch naming convention change

Tested through rc.0 to rc.15, all tests passed.
EOF
)"
```

### 3. Build & Verify

```bash
npm install
npm run build

# Verify build success
echo "Build completed successfully"
```

### 4. Publish to npm (latest tag)

```bash
# Package 1: SDK
cd packages/sdk
npm publish --access public

# Package 2: CLI
cd ../cli
npm publish --access public

# Package 3: crewx wrapper (MAIN PACKAGE)
cd ../crewx
npm publish --access public

# Return to root
cd ../..

# Verify all 3 packages
npm view @sowonai/crewx-sdk version
npm view @sowonai/crewx-cli version
npm view crewx version
```

### 5. Merge to main

```bash
git checkout main
git pull origin main
git merge --no-ff release/0.7.8 -m "Merge release/0.7.8 into main"
git push origin main
```

### 6. Merge to develop

```bash
git checkout develop
git pull origin develop
git merge --no-ff release/0.7.8 -m "Merge release/0.7.8 into develop"
git push origin develop
```

### 7. Create Git Tag

```bash
git tag v0.7.8
git push origin v0.7.8
```

### 8. Create GitHub Release

```bash
gh release create v0.7.8 --title "v0.7.8" --notes "$(cat <<'EOF'
## What's New in 0.7.8

### Bug Fixes
- **Slack Active Speaker Model** (#14, #15, #16): Fixed thread response handling - only the mentioned agent responds in threads
- **Thread Context** (#22, #25): Fixed conversation history not being passed in CLI --thread mode
- **Log Limits** (#28): Increased log truncation limits by 10x for better debugging

### Improvements
- **Node.js Requirement**: Now requires Node.js >= 20.19.0 for ESM compatibility
- **Help Version**: Fixed version display in `crewx help` command
- **UTF-8 Encoding** (#18): Cross-platform encoding fix for spawn processes

### Installation
\`\`\`bash
npm install -g crewx
crewx --version  # Should show 0.7.8
\`\`\`

### Requirements
- Node.js >= 20.19.0
EOF
)"
```

---

## Post-Release Verification

- [ ] `npm view crewx version` → 0.7.8
- [ ] `npm install -g crewx` → 설치 성공
- [ ] `crewx --version` → 0.7.8
- [ ] GitHub Release 페이지 확인
- [ ] main 브랜치에 v0.7.8 태그 확인

---

## Cleanup

```bash
# Remove release worktree if exists
git worktree remove worktree/release-0.7.8 --force 2>/dev/null || true

# Update status.md
# reports/status.md 에 정식 릴리스 완료 기록
```

---

## Issues Included

| ID | Description | Status |
|----|-------------|--------|
| #8 | Layout Props for toggling default sections | Resolved |
| #9 | Clean up test and debug files | Resolved |
| #14 | All bots respond simultaneously in threads | Resolved |
| #15 | Bot doesn't respond after mention switch | Resolved |
| #16 | All bots respond after file-only upload | Resolved |
| #18 | Cross-platform UTF-8 encoding | Resolved |
| #22 | cli/codex provider thread context not passed | Resolved |
| #25 | CLI --thread: conversation_history not in prompt | Resolved |
| #28 | Increase log truncation limits (10x) | Resolved |
| #31 | ERR_REQUIRE_ESM Windows issue | Closed (Node version) |
