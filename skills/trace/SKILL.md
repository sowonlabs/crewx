---
name: trace
description: traces.db 분석 스킬. 에이전트 작업 이력 추적, 미완료 작업 발견, 비용 분석.
version: 0.1.0
---

# Trace Skill

traces.db를 분석하여 에이전트 작업 이력을 추적하는 스킬입니다.

## 왜 이 스킬인가?

- **작업 추적**: 누가 언제 무슨 작업을 했는지 추적
- **미완료 작업 발견**: uncommitted 변경사항과 관련된 작업 찾기
- **비용 분석**: 토큰 사용량과 비용 통계

## 사용법

```bash
# 최근 작업 이력 조회 (기본 10개)
node skills/trace/trace.js

# 특정 에이전트 작업 이력
node skills/trace/trace.js agent crewx_claude_dev

# 특정 이슈 관련 작업
node skills/trace/trace.js issue 89

# 비용/토큰 통계
node skills/trace/trace.js cost

# 오늘 작업 이력
node skills/trace/trace.js today

# 키워드 검색
node skills/trace/trace.js search "pricing"

# 상세 정보 (특정 task_id)
node skills/trace/trace.js detail task_1767786361382_u5keq6v9o
```

## 주요 기능

### 1. 최근 작업 이력 (`recent`)
```bash
node skills/trace/trace.js
# 또는
node skills/trace/trace.js recent 20  # 최근 20개
```

### 2. 에이전트별 작업 (`agent`)
```bash
node skills/trace/trace.js agent crewx_claude_dev
node skills/trace/trace.js agent crewx_codex_dev --limit 5
```

### 3. 이슈별 작업 (`issue`)
```bash
node skills/trace/trace.js issue 89  # #89 관련 모든 작업
```

### 4. 비용 분석 (`cost`)
```bash
node skills/trace/trace.js cost         # 전체 비용 요약
node skills/trace/trace.js cost today   # 오늘 비용
node skills/trace/trace.js cost agent   # 에이전트별 비용
```

### 5. 검색 (`search`)
```bash
node skills/trace/trace.js search "PR #90"
node skills/trace/trace.js search "pricing"
```

## 출력 예시

```
# 최근 작업 이력

| 시간 | 에이전트 | 모드 | 상태 | 프롬프트 요약 |
|------|---------|------|------|--------------|
| 11:46 | crewx_release_manager | execute | success | Publish 0.8.0-rc.20... |
| 07:14 | crewx_claude_dev | query | success | Review PR #90... |
```

## 에이전트 프롬프트 가이드

```markdown
# 작업 이력 확인

누가 어떤 작업을 했는지 확인하려면:
```bash
node skills/trace/trace.js
```

특정 이슈 관련 작업 추적:
```bash
node skills/trace/trace.js issue <number>
```
```

## 의존성

- SQLite3 (better-sqlite3 또는 sqlite3 CLI)
- traces.db 파일 (`.crewx/traces.db`)

## 데이터 소스

traces.db의 `tasks` 테이블:
- `agent_id`: 실행한 에이전트
- `prompt`: 요청 내용
- `mode`: query/execute
- `status`: pending/running/success/failed
- `started_at`, `completed_at`: 시간 정보
- `input_tokens`, `output_tokens`, `cost_usd`: 비용 정보
