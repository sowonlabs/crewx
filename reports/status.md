# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-22 (v0.8.0-rc.0 릴리스 준비)

## 🚀 v0.8.0-rc.0

### 주요 변경사항
#### ✨ New Features
- **Agent Prompt Preview**: `crewx agent prompt @agent` 명령어로 렌더링된 페르소나 확인 가능 (#47)
- **WBS Skill**: Work Breakdown Structure 기반 프로젝트 관리 스킬 추가 (#39)

#### 🛠 Improvements
- `crewx_dev_lead` 에이전트에 WBS 스킬 추가
- `plan` 서브커맨드 제거 → `q`/`x`로 단일화
- 프로젝트 루트에서 crewx 실행하도록 수정 (`getProjectRoot()`)

## 🎯 현재 진행 중인 작업

| ID | Description | Worker | Status |
|----|-------------|--------|--------|
| #47 | Agent Prompt Preview 구현 | @crewx_gemini_dev | ✅ 완료 |

### Open PRs
| PR | Description | Status |
|----|-------------|--------|
| #39 | WBS Skill Test | Open |

## 📌 다음 할 일

### 🟢 v0.8.0 릴리스 마무리
- [ ] 전체 회귀 테스트 (Regression Test)
- [ ] 백로그 이슈 처리: #6, #7

## 🔗 Quick Links
- [GitHub Issues](https://github.com/sowonlabs/crewx/issues) - 이슈 목록
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스

---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.