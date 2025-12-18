# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-18 (v0.8.0-rc.0 개발 중)

## 🚀 v0.8.0-rc.0 개발 중

### WBS Skill 추가
- **Work Breakdown Structure** 기반 프로젝트 관리 스킬
- 복잡한 작업을 30분 단위 Job으로 분해하여 실행
- 다중 에이전트 조율 지원 (`@crewx_claude_dev`, `@copilot` 등)

### 주요 변경사항
- `skills/wbs/` 스킬 구현
- `crewx_dev_lead` 에이전트에 WBS 스킬 추가
- `plan` 서브커맨드 제거 → `q`/`x`로 단일화
- 프로젝트 루트에서 crewx 실행하도록 수정 (`getProjectRoot()`)

## 🎯 현재 진행 중인 작업

| ID | Description | Worker | Status |
|----|-------------|--------|--------|
| - | WBS Skill 추가 테스트 | - | 대기 |

### Open PRs
| PR | Description | Status |
|----|-------------|--------|
| #39 | WBS Skill Test - README/hello.js 생성 | Open (테스트용) |

## 📌 다음 할 일

### 🟢 v0.8.0 릴리스 준비
- [ ] WBS Skill 추가 테스트 및 버그 수정
- [ ] 백로그 이슈 처리: #6, #7 (Remote Provider 버그 수정)

## 🔗 Quick Links
- [GitHub Issues](https://github.com/sowonlabs/crewx/issues) - 이슈 목록
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스

---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.
