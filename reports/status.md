# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-24 17:30 KST (v0.8.0 개발 중)

## 🚀 v0.8.0 개발 중

### 주요 기능 (0.8.0-rc.5 기준)
- **Environment Variable Injection**: CREWX 환경 변수 자동 주입
- **TracingService with SQLite**: 에이전트 행위 추적 시스템 (Phase 1)
- **WBS Skill**: Work Breakdown Structure 기반 프로젝트 관리
- **Skill Usage Guide**: 기본 템플릿에 강화된 스킬 가이드

### 최근 릴리스
- v0.8.0-rc.5 (2025-12-24): Environment variable injection + tracing service
- v0.8.0-rc.4 (2025-12-24): Strengthen skill usage guide
- v0.8.0-rc.3: TracingService implementation

## 🎯 현재 진행 중인 작업

| ID | Description | Worker | Status |
|----|-------------|--------|--------|
| #58 | Slack 대화내역 타임스탬프 표시 기능 추가 | TBD | Pending |
| #59 | Gemini long single-line responses exceed 3000 char limit | @crewx_claude_dev | Pending |

### Resolved Issues (v0.8.0-rc.0 ~ rc.5에 포함됨)
| ID | Description | Worker | RC Version |
|----|-------------|--------|------------|
| #60 | crewx skill CLI subcommand (Claude Code 호환) | @crewx_gemini_dev | rc.6 (pending) |
| #55 | Strengthen skill usage guide in default template | @crewx_claude_dev | rc.4 |
| #53 | Observability MVP (Phase 0-2) - TracingService | - | rc.0 |
| #39 | MCP Server crewx_queryAgent parameter mapping failure | @crewx_claude_dev | rc.0 |
| #7 | Remote Provider: Version/Model info missing in query mode | - | rc.0 |
| #6 | Remote Provider Security Key Mismatch | - | rc.0 |

## 📌 다음 할 일

### 🟢 v0.8.0 릴리스 준비
- [x] Issue #60: crewx skill CLI subcommand ✅ Merged to release/0.8.0
- [ ] Issue #58: 슬랙 대화내역에 타임스탬프 추가 (target: v0.8.0)
- [ ] RC 버전 테스트 및 최종 릴리스 준비

## 🔗 Quick Links
- [GitHub Issues](https://github.com/sowonlabs/crewx/issues) - 이슈 목록
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스

---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.
