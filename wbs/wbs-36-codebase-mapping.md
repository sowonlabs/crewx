# WBS-36: Observability Design - Codebase Mapping Analysis

> **작성자**: @crewx_claude_dev
> **작성일**: 2025-12-18
> **WBS**: wbs-4, Job: job-7
> **상태**: 분석 완료

---

## 1. 설계 문서 요약 (observability-spec-v1.md)

### 1.1 핵심 기능
- **에이전트 행위 추적**: 스킬 사용, 명령 실행 기록
- **저장소**: `.crewx/traces.db` (SQLite)
- **주요 테이블**: `traces`, `trace_skills`, `trace_commands`
- **CLI 명령어**: `crewx trace ls/show/thread/stats/clean`

### 1.2 통합 포인트 (설계서 기준)
1. CrewXTool - 쿼리/실행 시작/종료 시점 추적
2. 스킬 로더 - 스킬 사용 추적
3. Slack 핸들러 - thread_ts 매핑

---

## 2. 기존 코드베이스 분석

### 2.1 TaskManagementService (`packages/cli/src/services/task-management.service.ts`)

#### 현재 구조
```typescript
interface TaskLog {
  id: string;
  type: 'query' | 'execute' | 'init' | 'doctor';
  agentId?: string;
  provider?: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  duration?: number;
  memoryUsage?: { start: number; end: number };
  prompt?: string;
  command?: string;
  options?: any;
  result?: any;
  logs: Array<{ timestamp: Date; level: 'info' | 'warn' | 'error'; message: string }>;
}
```

#### 주요 메서드
| 메서드 | 설명 |
|--------|------|
| `generateTaskId()` | `task_{timestamp}_{random}` 형식 ID 생성 |
| `createTask(options)` | 태스크 생성, 메모리에 저장, 로그 파일 생성 |
| `addTaskLog(taskId, log)` | 태스크에 로그 추가 |
| `completeTask(taskId, result, success)` | 태스크 완료 처리 |
| `getTaskLogsFromFile(taskId?)` | 파일에서 로그 읽기 |
| `getTaskStatistics()` | 통계 반환 (total, running, completed, failed, byProvider, byType) |
| `cleanupOldTasks(keepCount)` | 오래된 태스크 정리 (기본 100개 유지) |

#### 저장 구조
- **메모리**: `Map<string, TaskLog>`
- **파일**: `.crewx/logs/{taskId}.log` (텍스트 형식)

#### 설계 문서와의 비교

| 항목 | TaskManagementService (현재) | TracingService (설계) |
|------|------------------------------|----------------------|
| 저장소 | 텍스트 파일 (.log) | SQLite (traces.db) |
| ID 형식 | `task_{timestamp}_{random}` | UUID |
| 상태 | running/completed/failed | running/completed/failed (동일) |
| 토큰 추적 | ❌ 없음 | ✅ prompt_tokens, response_tokens |
| 스킬 추적 | ❌ 없음 | ✅ trace_skills 테이블 |
| 명령 추적 | ❌ 없음 | ✅ trace_commands 테이블 |
| 스레드 연결 | ❌ 없음 | ✅ thread_id, parent_trace_id |
| 모델 기록 | provider만 기록 | agent_id, model 분리 |

---

### 2.2 CrewXTool (`packages/cli/src/crewx.tool.ts`)

#### 현재 통합 방식
```typescript
// queryAgent, executeAgent 내부에서 TaskManagementService 사용

// 1. 태스크 생성
taskId = this.taskManagementService.createTask({
  type: 'query',  // or 'execute'
  provider: agentProvider,
  prompt: query,
  agentId: agentId
});

// 2. 로그 추가 (중간 과정)
this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `...` });

// 3. 완료 처리
this.taskManagementService.completeTask(taskId, response, response.success);
```

#### 통합 포인트 (코드 라인)
| 위치 | 설명 |
|------|------|
| `crewx.tool.ts:700-708` | queryAgent - 태스크 생성 |
| `crewx.tool.ts:1047-1048` | queryAgent - 태스크 완료 |
| `crewx.tool.ts:1216-1224` | executeAgent - 태스크 생성 |
| `crewx.tool.ts:1555-1556` | executeAgent - 태스크 완료 |

---

### 2.3 SkillLoaderService (`packages/cli/src/services/skill-loader.service.ts`)

#### 현재 구조
```typescript
interface SkillsConfig {
  include?: string[];
  exclude?: string[];
  autoload?: boolean;
}

class SkillLoaderService {
  loadAgentSkills(skillsConfig?: SkillsConfig): Promise<SkillDefinition[]>
  loadSkill(skillName: string): Promise<SkillDefinition | null>
  listAvailableSkills(): Promise<SkillDefinition[]>
}
```

#### 특징
- 스킬 메타데이터만 로드 (progressive disclosure)
- `SKILL.md` 파일에서 파싱
- 현재 스킬 **사용** 추적 기능 없음

#### TracingService 통합 필요 사항
- 스킬 실행 래퍼 추가 필요
- `trace_skills` 테이블에 기록: skill_name, input_summary, output_summary, execution_time_ms

---

### 2.4 SlackBot (`packages/cli/src/slack/slack-bot.ts`)

#### 현재 컨텍스트 정보
```typescript
// Slack 메시지 처리 시 사용 가능한 정보
message.channel       // 채널 ID
message.thread_ts     // 스레드 타임스탬프
message.ts            // 메시지 타임스탬프
message.user          // 사용자 ID
```

#### TracingService 통합 포인트
- `thread_ts` → `thread_id` 매핑 가능
- CrewXTool.queryAgent/executeAgent 호출 시 `metadata` 파라미터로 전달 가능

```typescript
// 현재 구조 (crewx.tool.ts:833)
metadata: metadata, // Pass platform-specific metadata (e.g., Slack channel_id, thread_ts)
```

---

## 3. 통합 전략 권고

### 3.1 접근 방식: 점진적 마이그레이션

**Phase 1: TracingService 추가 (병행 운영)**
```
┌─────────────────────┐     ┌─────────────────────┐
│ TaskManagementService│     │   TracingService    │
│   (기존 .log 파일)   │     │  (새로운 SQLite)    │
└─────────────────────┘     └─────────────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
              ┌───────────────┐
              │   CrewXTool   │
              │ (두 서비스 모두 호출) │
              └───────────────┘
```

**Phase 2: 완전 전환**
- TaskManagementService의 핵심 기능을 TracingService로 이전
- `crewx log` 명령어 → `crewx trace` 명령어로 대체

### 3.2 구체적 통합 포인트

#### CrewXTool 변경 (최소 변경)
```typescript
// queryAgent/executeAgent 시작 부분
const traceId = await this.tracingService.startTrace({
  agent_id: agentId,
  model: modelToUse,
  mode: 'query',
  platform: platform || 'cli',
  thread_id: metadata?.thread_ts,
  prompt: query
});

// queryAgent/executeAgent 완료 부분
await this.tracingService.completeTrace(traceId, {
  status: response.success ? 'completed' : 'failed',
  prompt_tokens: response.metadata?.promptTokens,
  response_tokens: response.metadata?.responseTokens,
  error_message: response.error
});
```

#### SkillLoaderService 변경 (스킬 래핑)
```typescript
// 스킬 실행 추적을 위한 래퍼 추가 필요
async executeWithTracing(
  skill: SkillDefinition,
  input: any,
  traceId: string
): Promise<any> {
  const startTime = Date.now();
  try {
    const result = await skill.execute(input);
    await this.tracingService.recordSkillUsage({
      trace_id: traceId,
      skill_name: skill.name,
      skill_version: skill.version,
      input_summary: this.summarize(input),
      output_summary: this.summarize(result),
      execution_time_ms: Date.now() - startTime
    });
    return result;
  } catch (error) {
    // 에러도 기록
  }
}
```

### 3.3 DI 설정 (app.module.ts)

```typescript
@Module({
  providers: [
    TaskManagementService,  // 기존 유지 (Phase 1)
    TracingService,         // 새로 추가
    // ... 기타 서비스
  ],
})
export class AppModule {}
```

---

## 4. 주요 고려사항

### 4.1 성능 영향
- **비동기 쓰기**: TracingService는 fire-and-forget 패턴 권장
- **메인 플로우 블로킹 없음**: 트레이싱 실패가 에이전트 실행에 영향 주지 않도록

### 4.2 데이터 마이그레이션
- 기존 `.crewx/logs/*.log` 파일 → SQLite 마이그레이션 필요 여부 결정 필요
- 권장: 신규 데이터만 SQLite, 기존 로그는 보존

### 4.3 CLI 명령어 공존
```
crewx log ls     # 기존 (TaskManagementService)
crewx trace ls   # 신규 (TracingService)
```

### 4.4 순환 의존성 방지
```
CrewXTool → TracingService → ✗ CrewXTool (금지)
```
- TracingService는 독립적으로 작동해야 함
- DB 쓰기 전용, 다른 서비스 의존성 최소화

---

## 5. 파일별 수정 범위 예상

| 파일 | 수정 내용 | 영향도 |
|------|----------|--------|
| `packages/cli/src/services/tracing.service.ts` | **신규 생성** | N/A |
| `packages/cli/src/crewx.tool.ts` | TracingService DI 주입, startTrace/completeTrace 호출 | 중간 |
| `packages/cli/src/services/skill-loader.service.ts` | 스킬 실행 래퍼 추가 (선택) | 낮음 |
| `packages/cli/src/slack/slack-bot.ts` | metadata에 thread_ts 포함 (이미 됨) | 없음 |
| `packages/cli/src/app.module.ts` | TracingService 등록 | 낮음 |
| `packages/cli/src/cli/trace.handler.ts` | **신규 생성** | N/A |

---

## 6. 결론

### 6.1 기술적 실현 가능성: ✅ 높음
- 기존 TaskManagementService 패턴이 TracingService와 유사
- DI 구조가 잘 갖춰져 있어 추가 용이
- 통합 포인트가 명확함 (CrewXTool의 queryAgent/executeAgent)

### 6.2 위험 요소: ⚠️ 중간
- SQLite 동시성: CLI + Slack Bot 동시 접근 시 WAL 모드 필요
- 기존 로그 시스템과의 공존 기간 필요
- 스킬 추적은 현재 스킬 시스템 구조 변경 필요할 수 있음

### 6.3 권장사항
1. **Phase 1**: TracingService만 추가, TaskManagementService와 병행
2. **Phase 2**: CLI 명령어 추가 (`crewx trace`)
3. **Phase 3**: 스킬 추적 기능 추가
4. **Phase 4**: TaskManagementService 점진적 deprecation

---

## 참고 문서

- [WBS-36 Design Review](./wbs-36-observability-design-review.md)
- [TaskManagementService](../packages/cli/src/services/task-management.service.ts)
- [CrewXTool](../packages/cli/src/crewx.tool.ts)
