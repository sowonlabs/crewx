# CrewX Observability System - MVP Design Document

**Version**: 1.0
**Date**: 2025-12-20
**Status**: Draft - Pending CEO Approval
**Implementation**: To be decided after review

---

## Executive Summary

CrewX Observability System은 에이전트의 모든 행위를 체계적으로 기록하고 추적하는 시스템입니다. HTTP Request Logging과 유사한 패러다임을 적용하여, 에이전트의 성능 분석, 오류 추적, 행동 패턴 학습을 가능하게 합니다.

### Core Principles

1. **작게 시작** - 성능 최적화는 나중에, 먼저 확실한 기록
2. **점진적 확장** - 기록만 잘 되면 기능은 언제든 추가 가능
3. **에이전트 격리** - 각 에이전트는 자신의 것만 조회 (보안)

---

## Architecture Overview

### Database: SQLite (`.crewx/traces.db`)

**Why SQLite?**
- CLI 도구 특성상 간단하고 충분
- WAL 모드로 동시성 확보
- 파티셔닝 불필요 (연간 10만건 이하 예상)
- 파일 기반으로 설치/관리 간편

**Configuration:**
- WAL (Write-Ahead Logging) 모드 활성화
- busy_timeout: 5초
- 단순함 > 최적화

---

## Database Schema

### 1. agent_execution_log (메인 실행 로그)

**모든 에이전트 실행을 Request-Response 패러다임으로 기록**

```sql
CREATE TABLE agent_execution_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,

  -- 버전 정보 (통계용)
  crewx_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_version TEXT,              -- nullable (획득 실패 시)
  model TEXT NOT NULL,

  -- 모드 구분
  mode TEXT NOT NULL CHECK(mode IN ('query', 'execute')),

  -- 요청/응답
  user_request TEXT,
  agent_response TEXT,

  -- 타이밍
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,

  -- 상태
  status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'timeout')),
  exit_code INTEGER,

  -- 컨텍스트 (선택적)
  input_context TEXT,                 -- JSON (필요 시만)
  step_durations TEXT                 -- JSON (필요 시만)
);

-- 인덱스
CREATE INDEX idx_execution_agent_started
  ON agent_execution_log(agent_id, started_at DESC);

CREATE INDEX idx_execution_stats
  ON agent_execution_log(provider, model, mode, started_at);

CREATE INDEX idx_execution_errors
  ON agent_execution_log(status, started_at DESC)
  WHERE status != 'success';
```

**Key Fields:**
- `mode`: Query (읽기 전용) vs Execute (파일 수정/실행)
- `provider`: cli/claude, cli/gemini, cli/copilot 등
- `provider_version`: 프로바이더 CLI 버전 (nullable)
- `crewx_version`: CrewX 자체 버전

---

### 2. agent_tool_calls (통합 도구 호출 로그)

**스킬, 내장 도구, MCP를 단일 테이블로 통합 관리**

```sql
CREATE TABLE agent_tool_calls (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,

  -- 도구 타입 (통합)
  tool_type TEXT NOT NULL CHECK(tool_type IN ('skill', 'tool', 'mcp')),
  tool_name TEXT NOT NULL,
  tool_source TEXT,                   -- MCP 서버명, 스킬 경로 등
  tool_method TEXT,                   -- MCP 메서드명 (MCP인 경우만)

  -- 입출력
  tool_input TEXT,                    -- JSON
  tool_output TEXT,                   -- JSON (64KB 제한)

  -- 성능
  duration_ms INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  called_at INTEGER NOT NULL,

  FOREIGN KEY (execution_id) REFERENCES agent_execution_log(id)
);

-- 인덱스
CREATE INDEX idx_tool_execution
  ON agent_tool_calls(execution_id);

CREATE INDEX idx_tool_stats
  ON agent_tool_calls(agent_id, tool_type, tool_name, called_at);
```

**Design Decision: 통합 테이블**
- 스킬, 도구, MCP는 모두 "호출 가능한 기능"으로 성격이 동일
- `tool_type` ENUM으로 구분: 'skill' | 'tool' | 'mcp'
- 통계 쿼리 단순화
- 테이블 수 줄임 (유지보수 편함)

**Output Truncation:**
- tool_output은 64KB로 제한
- Head-Tail 방식으로 잘림 (JSON 깨짐 방지)

---

### 3. FTS5 Full-Text Search (검색용)

```sql
CREATE VIRTUAL TABLE agent_logs_fts USING fts5(
  agent_id,
  user_request,
  agent_response,
  content='agent_execution_log',
  content_rowid='rowid'
);
```

**Why FTS5?**
- "지난주에 인증 관련 뭐 했지?" 같은 자연어 검색 가능
- `LIKE '%keyword%'`: 수백ms~초 (100k rows 기준)
- `FTS5`: Sub-millisecond
- Trade-off: 디스크 20-30% 증가 (무시 가능한 수준)

---

## Implementation Plan

### Phase 1: 기록 인프라 (1주)

**목표:** 모든 에이전트 행위를 DB에 기록

**담당:** @crewx_claude_dev

**작업 내용:**

1. **TracingService 확장**
   - SQLite DB 초기화 (WAL 모드)
   - 스키마 생성
   - 기본 CRUD 메서드

2. **실행 로깅**
   ```typescript
   class TracingService {
     async logExecution(params: {
       agentId: string;
       sessionId: string;
       crewxVersion: string;
       provider: string;
       providerVersion: string | null;
       model: string;
       mode: 'query' | 'execute';
       userRequest: string;
       agentResponse: string;
       startedAt: Date;
       completedAt: Date;
       status: 'success' | 'failure' | 'timeout';
       exitCode?: number;
     }) {
       // SQLite INSERT
     }
   }
   ```

3. **도구 호출 로깅**
   ```typescript
   class TracingService {
     async logToolCall(params: {
       executionId: string;
       agentId: string;
       toolType: 'skill' | 'tool' | 'mcp';
       toolName: string;
       toolSource?: string;
       toolMethod?: string;
       toolInput: any;
       toolOutput: any;  // 64KB truncate
       durationMs: number;
       status: 'success' | 'failure';
       errorMessage?: string;
     }) {
       // Truncate output if > 64KB
       const truncatedOutput = this.truncateOutput(params.toolOutput);
       // SQLite INSERT
     }
   }
   ```

4. **통합 지점**
   - `CrewXTool.execute()` 진입/종료 시점
   - 스킬 호출 시점
   - MCP 호출 시점

**검증:**
```bash
# 테스트 실행
crewx q "@claude test prompt"

# DB 확인
sqlite3 .crewx/traces.db "SELECT * FROM agent_execution_log LIMIT 1;"
sqlite3 .crewx/traces.db "SELECT * FROM agent_tool_calls LIMIT 5;"
```

---

### Phase 2: 조회 기능 (3-4일)

**목표:** 에이전트가 자기 과거 기록 조회 가능

**담당:** @crewx_codex_dev

**작업 내용:**

1. **CLI 명령어**
   ```bash
   # 기본 조회
   crewx trace ls                          # 최근 실행 목록
   crewx trace show <id>                   # 상세 조회
   crewx trace search "keyword"            # 텍스트 검색

   # 필터링
   crewx trace ls --agent crewx_claude_dev --mode execute
   crewx trace ls --status failure --days 7
   ```

2. **Built-in Tool (에이전트가 호출 가능)**
   ```typescript
   {
     name: 'query_my_execution_history',
     description: 'Query your own past execution logs to learn from previous actions',
     parameters: {
       days: {
         type: 'number',
         description: 'How many days to look back (default: 7)',
         default: 7
       },
       status: {
         type: 'string',
         enum: ['success', 'failure', 'all'],
         description: 'Filter by status (default: all)',
         default: 'all'
       },
       mode: {
         type: 'string',
         enum: ['query', 'execute', 'all'],
         description: 'Filter by mode (default: all)',
         default: 'all'
       },
       limit: {
         type: 'number',
         description: 'Max results (default: 10)',
         default: 10
       }
     }
   }
   ```

3. **출력 예시:**
   ```markdown
   **Your Recent Activity (Last 7 Days)**

   **2025-12-20 (Execute Mode)**
   ✅ **SUCCESS**: Implemented feature #42
   - Provider: cli/claude (sonnet)
   - Duration: 45s
   - Tools Used: bash (3), edit_file (5), read_file (8)

   ❌ **FAILURE**: Fixed authentication bug
   - Provider: cli/claude (sonnet)
   - Duration: 120s
   - Error: Test suite failed
   - Tools Used: bash (2), edit_file (3)

   **2025-12-19 (Query Mode)**
   ✅ **SUCCESS**: Code analysis
   - Provider: cli/claude (sonnet)
   - Duration: 12s
   - Tools Used: read_file (15), grep (3)
   ```

4. **FTS5 검색 통합**

---

### Phase 3: 통계/분석 (선택, 2일)

**담당:** @crewx_gemini_dev

**작업 내용:**

1. 프로바이더/모델별 통계 쿼리
2. 도구 사용 빈도 분석
3. 에러 패턴 리포트
4. CLI 명령어:
   ```bash
   crewx trace stats
   crewx trace stats --provider cli/claude
   crewx trace stats --model sonnet
   ```

**Note:** 나중에 추가 가능하므로 일단 보류 (기록이 먼저!)

---

## File Structure

```
packages/cli/src/
├── services/
│   ├── tracing.service.ts          # 핵심 로깅 로직
│   └── tracing-query.service.ts    # 조회 로직 (Phase 2)
├── handlers/
│   └── trace.handler.ts            # CLI 명령어 핸들러
└── tools/
    └── query-execution-history.tool.ts  # Built-in Tool

.crewx/
└── traces.db                       # SQLite DB
```

---

## Key Design Decisions

### 1. 모드 추가 (query vs execute)

**Why?**
- Query 모드: 읽기 전용 분석 (파일 수정 없음)
- Execute 모드: 실제 작업 (파일 수정, 명령 실행)
- 통계 시 모드별로 성공률, 처리 시간 분석 가능

**예시 쿼리:**
```sql
-- Query 모드 vs Execute 모드 성공률 비교
SELECT
  mode,
  COUNT(*) AS total,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
  ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate
FROM agent_execution_log
GROUP BY mode;
```

---

### 2. 도구 통합 (skill/tool/mcp → 단일 테이블)

**Why?**
- 성격이 같음 (모두 "호출 가능한 기능")
- 통계 쿼리 단순화
- 테이블 수 줄임 (유지보수 편함)

**구분 방법:**
- `tool_type` ENUM: `'skill' | 'tool' | 'mcp'`
- `tool_source`: MCP 서버명, 스킬 경로 등 추가 메타데이터

---

### 3. 파티셔닝 제거

**Why?**
- CLI 도구 특성상 데이터양 적음 (연간 10만건 이하 예상)
- SQLite WAL 모드로 성능 충분
- 단순함 > 최적화

---

### 4. FTS5 검색 포함

**Why?**
- "지난주에 인증 관련 뭐 했지?" 같은 자연어 검색 가능
- 디스크 20-30% 증가 (무시 가능)
- 나중에 추가하면 마이그레이션 복잡

---

## Decision Points

### DP-1: 구현 범위

- **Option A**: Phase 1만 (기록 인프라) - 1주
- **Option B**: Phase 1-2 (기록 + 조회) - 2주

**Dev Lead 추천:** **Option B**
- 이유: 기록만 해도 가치 있지만, "어떻게 보지?"가 막힘
- 조회 기능 있어야 에이전트가 실제로 활용 가능

---

### DP-2: FTS5 Full-Text Search

- **Option A**: Phase 1부터 포함
- **Option B**: Phase 2에서 추가

**Dev Lead 추천:** **Option A**
- 이유: 나중에 추가하면 기존 데이터 reindex 필요 (복잡)
- 지금 넣어두면 초기 데이터부터 검색 가능

---

### DP-3: provider_version 수집 전략

- **Option A**: nullable로 두고 획득 실패 시 null 저장
- **Option B**: 캐싱 구현해서 필수 수집

**Dev Lead 추천:** **Option A**
- 이유: 버전 정보 없어도 provider + model로 통계 가능
- 작게 시작 원칙에 맞음

---

## Use Cases

### 1. 에이전트 자기 반성

```typescript
// 에이전트가 과거 실패 패턴 학습
const history = await queryMyExecutionHistory({
  days: 30,
  status: 'failure',
  mode: 'execute'
});

// "아, 지난번에도 테스트 실행 안 하고 PR 만들어서 실패했구나"
```

---

### 2. 모드별 성능 분석

```sql
-- Query 모드는 빠르고, Execute 모드는 느림
SELECT
  mode,
  AVG(duration_ms) / 1000.0 AS avg_seconds,
  MAX(duration_ms) / 1000.0 AS max_seconds
FROM agent_execution_log
GROUP BY mode;
```

---

### 3. 프로바이더/모델별 비교

```sql
-- Claude Sonnet vs Opus 성공률 비교
SELECT
  provider,
  model,
  COUNT(*) AS total,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count
FROM agent_execution_log
WHERE provider = 'cli/claude'
GROUP BY model;
```

---

### 4. 가장 자주 실패하는 도구 찾기

```sql
SELECT
  tool_type,
  tool_name,
  COUNT(*) AS failure_count
FROM agent_tool_calls
WHERE status = 'failure'
GROUP BY tool_type, tool_name
ORDER BY failure_count DESC
LIMIT 10;
```

---

## Security & Privacy

### Agent Isolation (보안 필수)

- **각 에이전트는 자신의 것만 조회 가능**
- **다른 에이전트의 메모리 조회 금지** (민감 정보 유출 방지)
- Row-level security 적용
- `query_my_execution_history` 도구는 호출한 agent_id로 자동 필터링

---

## Future Extensions (점진적 확장)

기록이 쌓이면 상황에 따라 추가 가능:

1. **Prompt Evolution** - 메모리 기반 프롬프트 자동 개선 (Cloud 전용 가능)
2. **의미 기반 분석** - Embeddings + Vector Search (Cloud 전용 가능)
3. **팀 대시보드** - 여러 에이전트 통합 뷰 (Cloud Pro)
4. **자동 회상 주입** - 대화 시작 시 최근 실패/성공 사례 자동 주입

---

## Next Steps

**CEO 승인 받으면:**

1. ✅ WBS 프로젝트 생성: `wbs-7-observability-mvp`
2. ✅ Job 등록:
   - Job 1: TracingService 구현 (schema + logging)
   - Job 2: CLI 명령어 구현 (trace ls/show/search)
   - Job 3: Built-in Tool 구현 (query_my_execution_history)
3. ✅ Phase 1 착수: @crewx_claude_dev 배정

**구현은 내일 검토 후 결정**

---

## References

- HTTP Request Logging 패턴 참고 (sowonai_api.request_log)
- SQLite WAL 모드: https://sqlite.org/wal.html
- FTS5 Full-Text Search: https://sqlite.org/fts5.html

---

**Document End**
