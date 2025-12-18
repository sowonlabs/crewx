# WBS-4: Observability 설계 문서 분석 및 코드베이스 매핑

## 분석 일자
2025-12-18

## Phase 1: 설계 문서 분석 및 기존 코드베이스 매핑

### 1.1 분석 대상 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| Observability Design Review | `wbs/wbs-36-observability-design-review.md` | Observability 시스템 설계 검토 문서 |

### 1.2 설계 문서 핵심 요구사항

WBS-36 설계 문서에서 정의된 Observability 시스템의 핵심 요구사항:

#### 1.2.1 저장소 (SQLite)
- **위치**: `.crewx/traces.db`
- **주요 테이블**: `traces`, `trace_skills`, `trace_commands`
- **동시성**: WAL 모드, `busy_timeout` 5000ms

#### 1.2.2 CLI 명령어
- `crewx trace ls` - 트레이스 목록 조회
- `crewx trace show` - 트레이스 상세 조회
- `crewx trace thread` - 스레드별 트레이스 조회
- `crewx trace stats` - 통계 조회
- `crewx trace clean` - 오래된 트레이스 삭제

#### 1.2.3 주요 통합 포인트
- **CrewXTool**: `runQuery()`, `runExecute()` 메서드
- **TaskManagementService**: 기존 태스크 관리와 연계
- **Slack 통합**: `thread_ts` → `threadId` 매핑
- **스킬 시스템**: 스킬 사용 추적

---

### 1.3 기존 코드베이스 매핑

#### 1.3.1 CrewXTool (핵심 통합 포인트)

**파일**: `packages/cli/src/crewx.tool.ts`

**관련 메서드**:
| 메서드 | 라인 | 설명 | Observability 통합 필요성 |
|--------|------|------|--------------------------|
| `queryAgent()` | 620-1048 | 에이전트 쿼리 실행 | 트레이스 시작/완료 기록 |
| `executeAgent()` | 1050-1499 | 에이전트 태스크 실행 | 트레이스 시작/완료 기록 |
| `queryAgentParallel()` | 1632-1835 | 병렬 쿼리 실행 | 다중 트레이스 관리 |
| `executeAgentParallel()` | 1837-2065 | 병렬 태스크 실행 | 다중 트레이스 관리 |

**기존 패턴 분석**:
```typescript
// 현재 TaskManagementService 사용 패턴 (crewx.tool.ts:645-656)
taskId = this.taskManagementService.createTask({
  type: 'query',
  provider: agentProvider,
  prompt: query,
  agentId: agentId
});
this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Started query agent ${agentDescriptor}` });
```

**통합 전략**:
- TracingService를 TaskManagementService와 유사한 패턴으로 DI
- `startTrace()` / `completeTrace()` 호출 추가
- 기존 `taskId`와 `traceId` 연계 가능

---

#### 1.3.2 TaskManagementService (참조 구현)

**파일**: `packages/cli/src/services/task-management.service.ts`

**분석**:
| 항목 | 현재 구현 | Observability 설계 |
|------|----------|-------------------|
| 저장소 | 파일 시스템 (.crewx/logs/) | SQLite (.crewx/traces.db) |
| ID 생성 | `task_{timestamp}_{random}` | UUID 또는 유사 |
| 상태 추적 | running/completed/failed | running/completed/failed |
| 메모리 사용량 | 추적함 | 미정의 |
| 토큰 카운트 | 미추적 | `prompt_tokens`, `response_tokens` |

**재사용 가능 패턴**:
```typescript
// 태스크 생성 패턴 (재사용 가능)
interface TaskLog {
  id: string;
  type: 'query' | 'execute' | 'init' | 'doctor';
  agentId?: string;
  provider?: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  // ...
}
```

---

#### 1.3.3 Slack 통합

**파일**: `packages/cli/src/slack/slack-bot.ts`

**스레드 관련 코드**:
- `message.thread_ts` - Slack 스레드 타임스탬프
- `threadId` - CrewX 내부 식별자 (`channel:thread_ts` 형식)

**SlackConversationHistoryProvider**:
- **파일**: `packages/cli/src/conversation/slack-conversation-history.provider.ts`
- **스레드 ID 형식**: `"channel:thread_ts"` (라인 94-99)

**통합 전략**:
- `metadata.platformMetadata` 필드에 `thread_ts` 포함 (현재 구현됨, crewx.tool.ts:777)
- TracingService에서 `threadId` 필드로 Slack 스레드 추적

---

#### 1.3.4 스킬 시스템

**파일**: `packages/cli/src/services/skill-loader.service.ts`

**현재 구현**:
- 스킬 로드만 담당 (라인 32-73)
- 스킬 실행 추적 없음

**통합 전략**:
1. 옵션 A: 스킬 실행 래퍼 구현 (권장)
2. 옵션 B: CrewXTool에서 스킬 사용 후 수동 기록

---

#### 1.3.5 NestJS 모듈 구조

**파일**: `packages/cli/src/app.module.ts`

**현재 DI 구조**:
```typescript
providers: [
  // 기존 서비스
  TaskManagementService,
  SkillLoaderService,
  // ... 기타 서비스
]
```

**TracingService 추가 위치**:
- `providers` 배열에 `TracingService` 추가
- `CrewXTool` 생성자에 DI

---

### 1.4 기존 서비스 목록 (통합 영향 분석)

| 서비스 | 파일 | 통합 영향도 |
|--------|------|------------|
| `TaskManagementService` | task-management.service.ts | 높음 - 참조 구현 |
| `SkillLoaderService` | skill-loader.service.ts | 중간 - 스킬 추적 |
| `ProviderBridgeService` | provider-bridge.service.ts | 낮음 - 프로바이더 정보 |
| `AgentLoaderService` | agent-loader.service.ts | 낮음 - 에이전트 정보 |
| `ConfigService` | config.service.ts | 낮음 - 설정 참조 |
| `DocumentLoaderService` | document-loader.service.ts | 없음 |
| `ResultFormatterService` | result-formatter.service.ts | 없음 |

---

### 1.5 Gap 분석

#### 1.5.1 설계 문서 Gap

| 항목 | 설계 문서 정의 | 기존 코드베이스 | Gap |
|------|---------------|----------------|-----|
| SQLite 초기화 | 정의됨 | 없음 | 구현 필요 |
| TracingService | 인터페이스만 | 없음 | 구현 필요 |
| CLI 명령어 | ls/show/thread/stats/clean | 없음 | 구현 필요 |
| WAL 모드 설정 | 정의됨 | 없음 | 구현 필요 |
| 토큰 카운트 | 정의됨 | 미추적 | 구현 필요 |

#### 1.5.2 구현 우선순위

1. **P0**: TracingService 기본 구현 (startTrace, completeTrace)
2. **P0**: SQLite 스키마 및 초기화
3. **P1**: CrewXTool 통합 (queryAgent, executeAgent)
4. **P1**: CLI 명령어 (trace ls, trace show)
5. **P2**: Slack 스레드 통합
6. **P2**: 스킬 사용 추적
7. **P3**: 통계 및 정리 명령어

---

### 1.6 아키텍처 일관성 검증

#### 1.6.1 NestJS 패턴 준수

| 항목 | 기존 패턴 | 권장 구현 |
|------|----------|----------|
| DI | @Injectable() 데코레이터 | 동일 |
| 로거 | Logger 클래스 사용 | 동일 |
| 모듈 등록 | AppModule.providers | 동일 |
| 설정 | ConfigService 참조 | 동일 |

#### 1.6.2 파일 시스템 패턴

| 항목 | 기존 패턴 | 권장 구현 |
|------|----------|----------|
| 디렉토리 | `.crewx/logs/` | `.crewx/` (traces.db) |
| 생성 시점 | 서비스 constructor | 동일 |
| 권한 검사 | fs.existsSync | 동일 |

---

### 1.7 WBS-36 설계 검토 항목과 코드베이스 매핑

#### 1.7.1 Phase 1-1: traces 테이블 구조 분석

WBS-36 설계 검토 항목과 기존 코드베이스 비교:

| 검토 항목 | 설계 요구사항 | 기존 코드 참조 | 구현 전략 |
|-----------|--------------|----------------|----------|
| `id` 생성 전략 | UUID | `task_{timestamp}_{random}` (TaskManagementService:56) | UUID 채택 권장 |
| `created_at`, `completed_at` | TEXT (ISO 8601) | `new Date()` 객체 사용 | ISO 8601 문자열로 표준화 |
| `status` CHECK | running/completed/failed | 동일 (TaskLog:14) | 그대로 유지 |
| `prompt_tokens`, `response_tokens` | INTEGER | 미추적 | 새로 추가 필요 |
| `thread_id` | nullable | metadata에서 간접 참조 (crewx.tool.ts:777) | metadata.thread_ts에서 추출 |
| `parent_trace_id` | 자기참조 FK | 없음 | 새로 추가 (병렬 에이전트용) |

#### 1.7.2 Phase 2-1: TracingService 인터페이스 설계

기존 TaskManagementService 메서드와 TracingService 메서드 매핑:

| TaskManagementService 메서드 | TracingService 대응 메서드 | 차이점 |
|------------------------------|---------------------------|--------|
| `createTask(options)` | `startTrace(options)` | SQLite 기반, 토큰 추적 추가 |
| `addTaskLog(taskId, log)` | `recordSkillUsage()`, `recordCommand()` | 구조화된 별도 테이블 |
| `completeTask(taskId, result, success)` | `completeTrace(traceId, result)` | 토큰 카운트 포함 |
| `getTask(taskId)` | `findTraceById(traceId)` | SQLite 쿼리 |
| `getTasksByStatus(status)` | `findTraces(filters)` | 필터 확장 |
| `getTaskStatistics()` | `getTraceStats(options)` | 그래프 데이터 포함 |
| `cleanupOldTasks(keepCount)` | `cleanOldTraces(days)` | 날짜 기반 삭제 |

#### 1.7.3 Phase 2-2: 비동기 처리 패턴 분석

**현재 TaskManagementService 패턴** (task-management.service.ts):
- 동기적 파일 I/O: `fs.writeFileSync`, `fs.appendFileSync` (라인 316, 330)
- 메모리 Map 사용: `private readonly taskLogs = new Map<string, TaskLog>()` (라인 44)

**TracingService 권장 패턴**:
- WAL 모드 SQLite로 읽기/쓰기 동시성 지원
- Fire-and-forget 비동기 쓰기 (main flow 블로킹 없음)
- busy_timeout 5000ms 설정

**동시성 시나리오 분석**:
```
CLI 프로세스          Slack Bot 프로세스
     │                      │
     ▼                      ▼
[TracingService]       [TracingService]
     │                      │
     └──────┬───────────────┘
            │
      [traces.db]
       (WAL 모드)
```

#### 1.7.4 Phase 4-1: CrewXTool 통합 포인트 상세

**queryAgent 통합** (crewx.tool.ts:620-1048):

| 위치 | 현재 코드 | TracingService 통합 |
|------|----------|---------------------|
| 645-650 | `taskManagementService.createTask()` | `tracingService.startTrace()` 병렬 호출 |
| 652 | `addTaskLog(taskId, ...)` | 선택적 상세 로깅 |
| 702, 710 | `completeTask(taskId, ...)` | `tracingService.completeTrace()` |
| 777 | `metadata: metadata` | `thread_id: metadata?.thread_ts` 추출 |

**executeAgent 통합** (crewx.tool.ts:1050-1499):

| 위치 | 현재 코드 | TracingService 통합 |
|------|----------|---------------------|
| 1105-1110 | `taskManagementService.createTask()` | `tracingService.startTrace()` |
| 1238 | `metadata: metadata` | `thread_id: metadata?.thread_ts` 추출 |
| 완료 시점 | `completeTask()` | `tracingService.completeTrace()` |

#### 1.7.5 Phase 4-2: Slack 스레드 통합 분석

**thread_ts 흐름 분석** (slack-bot.ts):

```
[Slack Event]
     │
     ▼
message.thread_ts (라인 142, 151, 394)
     │
     ▼
threadId = `${channel}:${threadTs}` (라인 395)
     │
     ▼
queryOptions.metadata = { thread_ts: threadTs } (라인 492)
     │
     ▼
[CrewXTool.queryAgent]
     │
     ▼
templateContext.metadata.thread_ts (라인 777)
     │
     ▼
[TracingService.startTrace]
traces.thread_id = metadata.thread_ts
```

**SlackConversationHistoryProvider 통합** (slack-conversation-history.provider.ts):
- `threadId` 파싱: `channel:thread_ts` 형식 (라인 94-99)
- 메시지에 `thread_ts` 메타데이터 포함 (라인 202)

#### 1.7.6 Phase 5: 보안 및 성능 고려사항

**민감정보 처리**:
| 항목 | 현재 | 권장 |
|------|------|------|
| 프롬프트 저장 | TaskLog.prompt에 전체 저장 | 요약 또는 해시 옵션 |
| API 키 필터링 | 없음 | 환경변수 패턴 필터링 |
| DB 파일 권한 | N/A (텍스트 파일) | 0600 권한 설정 |

**성능 영향 예측**:
| 항목 | 예상 오버헤드 | 완화 전략 |
|------|-------------|----------|
| 트레이스 시작 | ~1-5ms | 비동기 쓰기 |
| 트레이스 완료 | ~1-5ms | 비동기 쓰기 |
| 스킬 기록 | ~1ms/스킬 | 배치 처리 고려 |

---

### 1.8 결론 및 권고사항

#### 1.8.1 기술적 실현 가능성

**결론**: ✅ 높음

설계 문서의 Observability 시스템은 기존 코드베이스 패턴과 일관성이 있으며,
TaskManagementService를 참조 구현으로 활용하여 구현 가능합니다.

#### 1.8.2 주요 권고사항

1. **TracingService 구현**
   - TaskManagementService 패턴 참조
   - better-sqlite3 또는 sql.js 사용

2. **CrewXTool 통합**
   - try-finally 패턴으로 트레이스 완료 보장
   - 기존 TaskManagementService 호출과 병행

3. **CLI 명령어**
   - 기존 `log.handler.ts` 패턴 참조
   - yargs 서브커맨드 구조 활용

4. **테스트 전략**
   - 기존 `tests/unit/services/` 구조 활용
   - SQLite 인메모리 모드로 단위 테스트

#### 1.8.3 WBS-36 검토 항목 체크리스트

**Phase 1: SQLite 스키마 검토**:
- [x] traces 테이블 구조 분석 완료
- [x] 기존 TaskLog 인터페이스와 비교 완료
- [ ] 인덱스 전략 검토 (구현 시 확정)
- [ ] FK 전략 검토 (구현 시 확정)

**Phase 2: API 설계 검토**:
- [x] TracingService 인터페이스 초안
- [x] 비동기 처리 패턴 분석 완료

**Phase 4: 통합 포인트 검토**:
- [x] CrewXTool 통합 포인트 식별 (queryAgent, executeAgent)
- [x] Slack 스레드 통합 흐름 분석 완료
- [ ] 스킬 추적 구현 전략 확정 필요

**Phase 5: 보안/성능**:
- [x] 민감정보 처리 전략 초안
- [x] 성능 영향 예측 완료

---

## 다음 단계

- [ ] Phase 2: TracingService 기본 구현
- [ ] Phase 3: SQLite 스키마 구현
- [ ] Phase 4: CrewXTool 통합
- [ ] Phase 5: CLI 명령어 구현
- [ ] Phase 6: 테스트 작성
