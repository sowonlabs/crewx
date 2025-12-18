# WBS Skill vs Direct Agent Delegation 비교표

이 문서는 CrewX에서 작업을 수행할 때 **WBS Skill**을 사용하는 방식과 **직접 Agent Delegation**을 사용하는 방식의 차이점, 장단점, 사용 시점을 비교합니다.

---

## 개념 비교

| 구분 | WBS Skill | Direct Agent Delegation |
|------|-----------|-------------------------|
| **정의** | 작업을 30분 단위 Job으로 분해하여 상태 관리와 함께 순차 실행 | `crewx x "@agent task"` 명령으로 에이전트에게 직접 작업 위임 |
| **실행 주체** | WBS Coordinator → Worker Agents | 사용자 → 단일 Agent |
| **상태 추적** | wbs.js 시스템에서 자동 추적 (pending/running/completed/failed) | 없음 (일회성 실행) |
| **작업 단위** | 15-45분 타임박싱된 Job | 제한 없음 (작업 크기 무관) |

---

## 상세 비교표

### 1. 작업 규모별 적합성

| 작업 규모 | WBS Skill | Direct Delegation | 권장 |
|-----------|-----------|-------------------|------|
| 단순 작업 (< 15분) | 오버헤드 발생 | 즉시 실행 가능 | **Direct** |
| 중간 작업 (15-45분) | 적합 | 적합 | 둘 다 가능 |
| 복잡한 작업 (> 45분) | 분해 후 관리 가능 | 컨텍스트 소실 위험 | **WBS** |
| 다단계 프로젝트 | 순차 실행, 진행률 추적 | 수동 관리 필요 | **WBS** |

### 2. 기능별 비교

| 기능 | WBS Skill | Direct Delegation |
|------|-----------|-------------------|
| **작업 분해** | AI가 30분 단위로 자동 분해 | 사용자가 수동 분할 |
| **진행률 추적** | `wbs.js status`로 실시간 확인 | 없음 |
| **실패 복구** | `job retry`로 재시도 가능 | 전체 재실행 필요 |
| **Git 워크플로우** | 자동 브랜치/PR 템플릿 제공 | 에이전트 설정에 따름 |
| **Issue 연동** | `--issue N` 옵션으로 GitHub 연동 | 수동 연결 |
| **실행 이력** | `exec list`로 조회 가능 | 없음 |
| **다중 에이전트** | Job별 다른 에이전트 배정 가능 | 단일 에이전트 |
| **타임아웃** | 30분 자동 타임아웃 | 없음 |

### 3. 사용 복잡도

| 측면 | WBS Skill | Direct Delegation |
|------|-----------|-------------------|
| **학습 곡선** | 높음 (CLI 명령어 학습 필요) | 낮음 |
| **설정 시간** | 프로젝트/Job 생성 필요 | 없음 (즉시 실행) |
| **명령어** | `wbs.js create/job add/job run` | `crewx x "@agent task"` |
| **최소 단계** | 3단계 (create → job add → run) | 1단계 |

---

## 장단점 비교

### WBS Skill

#### 장점
1. **체계적 작업 관리**: 복잡한 프로젝트를 구조화된 Job으로 분해
2. **진행 상황 가시성**: 실시간 진행률, 상태 추적
3. **실패 복구 용이**: 실패한 Job만 선별적 재시도 (`job retry`)
4. **컨텍스트 보존**: Detail 문서로 프로젝트 컨텍스트 유지
5. **다중 에이전트 조율**: Job별 최적 에이전트 배정
6. **워크플로우 표준화**: Git 브랜치, PR 템플릿 자동화
7. **이력 관리**: 실행 이력 보존으로 추후 분석 가능

#### 단점
1. **오버헤드**: 단순 작업에는 과도한 설정 필요
2. **학습 비용**: CLI 명령어와 개념 학습 필요
3. **유연성 제한**: 30분 타임박싱 강제
4. **의존성 관리**: 순차 실행만 지원 (병렬 미지원)

### Direct Agent Delegation

#### 장점
1. **즉각적 실행**: 설정 없이 바로 작업 위임
2. **단순함**: 단일 명령어로 완료
3. **유연성**: 작업 크기, 시간 제한 없음
4. **빠른 피드백**: 작은 작업에 적합

#### 단점
1. **상태 추적 불가**: 진행 상황 파악 어려움
2. **실패 복구 어려움**: 전체 재실행 필요
3. **컨텍스트 소실**: 긴 작업에서 Lost in the Middle 문제
4. **이력 없음**: 작업 기록 보존 안됨
5. **수동 관리**: 복잡한 프로젝트에서 관리 부담

---

## 실제 사용 사례

### WBS Skill 사용 권장 사례

#### 1. 새로운 기능 구현 프로젝트
```bash
# 예: User Authentication 시스템 구현
wbs.js create "User Authentication Implementation"
wbs.js job add wbs-1 --title "Design User model" --agent "@crewx_claude_dev" --seq 1
wbs.js job add wbs-1 --title "Implement login API" --agent "@crewx_codex_dev" --seq 2
wbs.js job add wbs-1 --title "Add JWT handling" --agent "@crewx_codex_dev" --seq 3
wbs.js job add wbs-1 --title "Write unit tests" --agent "@crewx_tester" --seq 4
wbs.js job run wbs-1
```
- **이유**: 다단계 작업, 다중 에이전트 필요, 진행 추적 필요

#### 2. 버그 수정 스프린트
```bash
wbs.js create "Bug Fix Sprint"
wbs.js job add wbs-2 --title "Fix login bug" --agent "@crewx_claude_dev" --issue 42 --seq 1
wbs.js job add wbs-2 --title "Fix session timeout" --agent "@crewx_claude_dev" --issue 43 --seq 2
wbs.js job add wbs-2 --title "Fix password reset" --agent "@crewx_claude_dev" --issue 44 --seq 3
wbs.js job run wbs-2
```
- **이유**: 여러 이슈를 체계적으로 처리, 진행률 추적

#### 3. 대규모 리팩토링
```bash
wbs.js create "API Refactoring"
wbs.js job add wbs-3 --title "Refactor auth module" --agent "@crewx_claude_dev" --seq 1
wbs.js job add wbs-3 --title "Refactor user module" --agent "@crewx_claude_dev" --seq 2
wbs.js job add wbs-3 --title "Update tests" --agent "@crewx_tester" --seq 3
wbs.js job add wbs-3 --title "Update documentation" --agent "@crewx_codex_dev" --seq 4
wbs.js job run wbs-3
```
- **이유**: 컨텍스트 보존 중요, 단계별 검증 필요

### Direct Delegation 사용 권장 사례

#### 1. 단순 코드 수정
```bash
crewx x "@crewx_codex_dev Fix typo in README.md"
```
- **이유**: 5분 내 완료, 상태 추적 불필요

#### 2. 단일 파일 작업
```bash
crewx x "@crewx_claude_dev Add validation to UserController.create() method"
```
- **이유**: 명확한 범위, 단일 작업

#### 3. 코드 분석/질의
```bash
crewx q "@crewx_claude_dev Explain how authentication flow works"
```
- **이유**: 분석 작업, 파일 수정 없음

#### 4. 빠른 프로토타입
```bash
crewx x "@crewx_codex_dev Create a simple Express server with health check endpoint"
```
- **이유**: 빠른 결과 필요, 추적 불필요

---

## 선택 가이드라인

### WBS Skill 선택 기준
- [ ] 작업이 45분 이상 소요 예상
- [ ] 3개 이상의 논리적 단계로 분해 가능
- [ ] 여러 에이전트의 협업 필요
- [ ] 진행 상황 추적이 중요
- [ ] 실패 시 부분 재시도 필요
- [ ] GitHub Issue와 연동 필요
- [ ] 팀에게 작업 상황 공유 필요

### Direct Delegation 선택 기준
- [ ] 15분 이내 완료 예상
- [ ] 단일 파일/모듈 작업
- [ ] 즉각적인 결과 필요
- [ ] 일회성 작업
- [ ] 분석/질의 목적
- [ ] 빠른 프로토타이핑

---

## 의사결정 플로우차트

```
작업 수신
    │
    ▼
예상 소요 시간?
    │
    ├─── < 15분 ──────────────────────► Direct Delegation
    │
    ├─── 15-45분 ─┬─ 단일 단계 ────────► Direct Delegation
    │             └─ 다단계 ───────────► WBS Skill
    │
    └─── > 45분 ──────────────────────► WBS Skill (분해 필수)
```

---

## 하이브리드 접근법

복잡한 프로젝트에서는 두 방식을 조합하여 사용할 수 있습니다:

```bash
# 1. WBS로 전체 프로젝트 관리
wbs.js create "Feature Implementation"

# 2. 복잡한 작업은 WBS Job으로
wbs.js job add wbs-1 --title "Design architecture" --agent "@crewx_claude_dev" --seq 1

# 3. 실행 중 발견된 간단한 작업은 Direct로 즉시 처리
crewx x "@crewx_codex_dev Fix import statement in utils.ts"

# 4. WBS 계속 진행
wbs.js job run wbs-1
```

---

## 요약

| 상황 | 권장 방식 |
|------|----------|
| 단순/빠른 작업 | Direct Delegation |
| 복잡한 프로젝트 | WBS Skill |
| 진행 추적 필요 | WBS Skill |
| 즉각적 결과 필요 | Direct Delegation |
| 다중 에이전트 협업 | WBS Skill |
| 단일 에이전트 작업 | Direct Delegation |
| 실패 복구 중요 | WBS Skill |
| 일회성 작업 | Direct Delegation |

**핵심 원칙**: 작업의 복잡도와 관리 필요성에 따라 적절한 도구를 선택합니다. 단순한 작업에 WBS를 사용하면 오버헤드가 발생하고, 복잡한 작업에 Direct Delegation만 사용하면 관리가 어려워집니다.
