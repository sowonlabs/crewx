# GitHub Labels Guide

CrewX 프로젝트의 GitHub 라벨 시스템입니다. 모든 라벨은 `scripts/setup-github-labels.sh`로 설정됩니다.

## 라벨 카테고리

### Type Labels (유형)

이슈/PR의 종류를 분류합니다.

| 라벨 | 색상 | 설명 | 사용 예시 |
|------|------|------|----------|
| `type:bug` | #d73a4a (빨강) | 버그, 오작동 | 크래시, 에러, 예상과 다른 동작 |
| `type:feature` | #a2eeef (하늘) | 새 기능 요청 | 새 CLI 명령어, API 추가 |
| `type:docs` | #0075ca (파랑) | 문서 개선 | README 업데이트, 가이드 추가 |
| `type:refactor` | #fbca04 (노랑) | 코드 리팩토링 | 구조 변경 (기능 변화 없음) |
| `type:test` | #bfd4f2 (연보라) | 테스트 개선 | 테스트 추가, 테스트 수정 |
| `type:security` | #b60205 (진빨강) | 보안 관련 | 취약점, 보안 패치 |
| `type:performance` | #d4c5f9 (연보라) | 성능 개선 | 속도 최적화, 메모리 개선 |
| `type:maintenance` | #c5def5 (연파랑) | 유지보수 | 의존성 업데이트, 정리 작업 |

### Priority Labels (우선순위)

작업 긴급도를 표시합니다.

| 라벨 | 색상 | 설명 | 대응 시간 |
|------|------|------|----------|
| `priority:critical` | #b60205 (진빨강) | 즉시 수정 필요 | 당일 |
| `priority:high` | #d93f0b (주황) | 빠른 수정 필요 | 1-2일 |
| `priority:medium` | #fbca04 (노랑) | 일반 우선순위 | 스프린트 내 |
| `priority:low` | #0e8a16 (녹색) | 낮은 우선순위 | 여유 있을 때 |

### Status Labels (상태)

현재 진행 상태를 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `status:triage` | #ededed (회색) | 분류 및 평가 필요 |
| `status:confirmed` | #c2e0c6 (연녹색) | 확인됨, 작업 가능 |
| `status:in-progress` | #0052cc (파랑) | 현재 작업 중 |
| `status:blocked` | #b60205 (빨강) | 외부 의존성으로 차단됨 |
| `status:needs-info` | #d876e3 (분홍) | 추가 정보 필요 |
| `status:wontfix` | #ffffff (흰색) | 수정하지 않음 |
| `status:duplicate` | #cfd3d7 (연회색) | 중복 이슈 |

### Component Labels (컴포넌트)

영향받는 패키지/모듈을 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `component:cli` | #5319e7 (보라) | CLI 패키지 (packages/cli) |
| `component:sdk` | #1d76db (파랑) | SDK 패키지 (packages/sdk) |
| `component:slack` | #4a154b (슬랙보라) | Slack Bot 통합 |
| `component:mcp` | #6f42c1 (보라) | MCP Server |
| `component:docs` | #0075ca (파랑) | 문서 |
| `component:ci` | #333333 (검정) | CI/CD, GitHub Actions |

### Release Labels (릴리즈)

릴리즈 계획을 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `release:breaking` | #b60205 (빨강) | Breaking changes 포함 |
| `release:next-minor` | #c5def5 (연파랑) | 다음 마이너 릴리즈 타겟 |
| `release:next-patch` | #c2e0c6 (연녹색) | 다음 패치 릴리즈 타겟 |
| `release:next-major` | #fbca04 (노랑) | 다음 메이저 릴리즈 타겟 |

### Workflow Labels (워크플로우)

특수한 워크플로우 상태를 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `good-first-issue` | #7057ff (보라) | 신규 기여자에게 적합 |
| `help-wanted` | #008672 (청록) | 추가 관심 필요 |
| `discussion` | #cc317c (분홍) | 구현 전 논의 필요 |
| `rfc` | #fbca04 (노랑) | 설계 의견 요청 |
| `needs-review` | #0e8a16 (녹색) | 코드 리뷰 필요 |

## 라벨 조합 규칙

### 필수 라벨

모든 이슈에는 최소 다음 라벨이 필요합니다:

1. **type:** 라벨 (1개 필수)
2. **priority:** 라벨 (1개 필수)

### 권장 조합

| 시나리오 | 권장 라벨 조합 |
|----------|---------------|
| 긴급 버그 | `type:bug` + `priority:critical` + `component:*` + `status:in-progress` |
| 새 기능 | `type:feature` + `priority:*` + `component:*` + `status:triage` |
| 보안 이슈 | `type:security` + `priority:critical` + `component:*` |
| 문서 개선 | `type:docs` + `priority:low` + `good-first-issue` |
| Breaking 변경 | `type:feature` + `release:breaking` + `release:next-major` |

### 상태 전이

```
status:triage → status:confirmed → status:in-progress → (PR 머지) → 종료
                              ↘ status:wontfix
                              ↘ status:duplicate
                              ↘ status:needs-info → status:confirmed
```

## gh CLI로 라벨 관리

### 라벨 조회

```bash
# 모든 라벨 목록
gh label list

# 특정 패턴 검색
gh label list | grep "type:"
```

### 라벨 추가/제거

```bash
# 이슈에 라벨 추가
gh issue edit <번호> --add-label "priority:high,status:in-progress"

# 이슈에서 라벨 제거
gh issue edit <번호> --remove-label "status:triage"
```

### 라벨로 이슈 검색

```bash
# 특정 라벨 이슈 검색
gh issue list --label "type:bug,priority:critical"

# 여러 라벨 조합 검색
gh issue list --label "type:bug" --label "component:cli"
```

## 라벨 설정

새 저장소에서 라벨 설정:

```bash
./scripts/setup-github-labels.sh sowonlabs/crewx
```

이 스크립트는 기존 라벨을 업데이트하고, 레거시 라벨(`bug`, `enhancement`, `documentation`)을 삭제합니다.
