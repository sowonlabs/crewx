# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-18 (v0.7.8 정식 릴리스 완료)

## 🎉 v0.7.8 정식 릴리스 완료

- **릴리스 일자**: 2025-12-18
- **현재 배포**: v0.7.8 (npm latest 태그)
- **릴리스 타입**: Bug fix release (Slack thread handling - Active Speaker 모델)
- **GitHub Release**: [v0.7.8](https://github.com/sowonlabs/crewx/releases/tag/v0.7.8)

## 🎯 현재 진행 중인 작업

없음 (다음 릴리스 준비 중)

## ✅ 완료된 작업 (v0.7.8)

### 포함된 이슈 및 개선사항

| ID | Description | Status |
|----|-------------|--------|
| #8 | Layout Props for toggling default sections | ✅ Merged - Resolved |
| #9 | Clean up test and debug files | ✅ Merged - Resolved |
| #14 | All bots respond simultaneously in threads | ✅ Merged - Resolved |
| #15 | Bot doesn't respond after mention switch | ✅ Merged - Resolved |
| #16 | All bots respond after file-only upload | ✅ Merged - Resolved |
| #18 | Cross-platform UTF-8 encoding for spawn | ✅ Merged - Resolved |
| #22 | cli/codex provider thread context not passed | ✅ Merged - Resolved |
| #25 | CLI --thread: conversation_history not in prompt | ✅ Merged - Resolved |
| #28 | Increase log truncation limits (10x) | ✅ Merged - Resolved |
| #12 | TypeScript tsserver skill 추가 | ✅ Merged - Resolved |

### 추가 개선사항

- 스모크 테스트 가이드, Tester 모델 업그레이드 (sonnet)
- 로그 한계값 10배 증가
- UTF-8 크로스 플랫폼 인코딩
- Node 버전 요구사항 추가 (>=20.19.0) - 모든 패키지에 engines 필드 추가
- Help 버전 표시 버그 수정 (cwd 대신 package 경로 사용)
- Branch naming convention 변경 (feature/issue-<number>)

### 종료된 이슈

| ID | Description | Status |
|----|-------------|--------|
| #10 | Slack: Multiple unmentioned agents respond | ❌ Active Speaker로 대체 (#14-16) |
| #24 | WBS spec cleanup - layoutProps consistency | ❌ Closed (duplicate of #25) |
| #31 | ERR_REQUIRE_ESM Windows issue | ❌ Closed (Root cause: Node <20.19.0) |

## 📌 다음 할 일

### 🟢 다음 릴리스 준비 (0.7.9 또는 0.8.0)
- [ ] **백로그 이슈 처리**: #6, #7 (Remote Provider 버그 수정)
- [ ] **새로운 피처 이슈 정리**: 필요 시 이슈 생성
- [ ] **기술 부채 정리**: 코드 리팩토링 검토

## 🔗 Quick Links
- [GitHub Issues](https://github.com/sowonlabs/crewx/issues) - 이슈 목록
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스

---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.
