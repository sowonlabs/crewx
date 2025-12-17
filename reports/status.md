# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-18 (v0.7.8-rc.12 배포 완료)

## 🎯 현재 진행 중인 작업

### 🚀 릴리스: 0.7.8 (RC 배포 완료)
- **현재 배포**: v0.7.7 (npm latest 태그)
- **RC 버전**: v0.7.8-rc.12 (✅ 배포 완료 - npm next 태그)
- **릴리스 타입**: Bug fix release (Slack thread handling - Active Speaker 모델)
- **포함 이슈**: #8, #9, #14, #15, #16, #18, #22, #25, #28, #31
- **추가 개선**:
  - 스모크 테스트 가이드, Tester 모델 업그레이드 (sonnet), 로그 한계값 10배 증가
  - UTF-8 크로스 플랫폼 인코딩 (#18)
  - @sindresorhus/slugify 버전 고정 (#31)
  - Branch naming convention 변경 (feature/issue-<number>)
- **다음 액션**: 스모크 테스트 → 정식 릴리스
- **블로커**: 없음

### 📋 Issue Status (Target Release: 0.7.8)

| ID | Description | Worker | Reviewer | Status |
|----|-------------|--------|----------|--------|
| #8 | Layout Props for toggling default sections | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.6) - Resolved |
| #9 | Clean up test and debug files | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.6) - Resolved |
| #10 | Slack: Multiple unmentioned agents respond | crewx_claude_dev | crewx_gemini_dev | ✅ Active Speaker로 대체 (#14-16) |
| #14 | All bots respond simultaneously in threads | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.4) - Resolved |
| #15 | Bot doesn't respond after mention switch | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.4) - Resolved |
| #16 | All bots respond after file-only upload | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.4) - Resolved |
| #18 | Cross-platform UTF-8 encoding for spawn | crewx_claude_dev | - | ✅ Merged (rc.5) - Resolved |
| #22 | cli/codex provider thread context not passed | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.9 - PR #27) - Resolved |
| #24 | WBS spec cleanup - layoutProps consistency | crewx_claude_dev | - | ❌ Closed (duplicate of #25) |
| #25 | CLI --thread: conversation_history not in prompt | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.8) - PR #26 |

### ✅ 완료된 작업 (0.7.8)

| ID | Description | Status |
|----|-------------|--------|
| #12 | TypeScript tsserver skill 추가 | ✅ Merged to develop (feature/tsserver-skill) |

### 🔧 진행 중인 작업 (0.7.8)

| ID | Description | Worker | Reviewer | Status |
|----|-------------|--------|----------|--------|
| #28 | Increase log truncation limits (10x) | crewx_claude_dev | crewx_gemini_dev | ✅ Merged (rc.11 - PR #29) - Deployed |
| #31 | Pin @sindresorhus/slugify to 1.1.2 | crewx_claude_dev | - | ✅ Merged (rc.12) - Deployed |

## 📌 다음 할 일

### 🔴 우선순위 1 (긴급)
- [x] **이슈 #14, #15, #16**: 0.7.8 타겟 설정 및 개발 진행 ✅
- [x] **PR #17 병합**: release/0.7.8-rc.4 병합 완료 ✅
- [x] **v0.7.8-rc.4 태그 생성**: 태그 생성 및 npm 배포 완료 ✅
- [ ] **QA 테스트**: v0.7.8-rc.5 버전 테스트 실행

### 🟡 우선순위 2 (중요)
- [x] **기존 PR 리뷰 완료**: #8, #9 리뷰 및 병합 ✅
- [ ] **0.7.8 정식 릴리스**: QA 통과 후 main 병합 및 npm publish

### 🟢 우선순위 3 (일반)
- [ ] **백로그 이슈 처리**: #6, #7 (Remote Provider 버그 수정)

## 🔗 Quick Links
- [GitHub Issues](https://github.com/sowonlabs/crewx/issues) - 이슈 목록
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스

---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.
