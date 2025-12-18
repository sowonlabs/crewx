# Observability 구현 가능성 검토

## 개요

CrewX 플랫폼의 Observability(관측 가능성) 시스템 구현을 위한 검토 문서입니다.
CLI, MCP Server, Slack Bot 등 다양한 플랫폼에서 발생하는 AI 에이전트 실행 로그, 성능 메트릭, 에러 추적 기능 구현을 목표로 합니다.

## 요구사항

1. **실행 추적**: 에이전트 실행 시작/종료, 소요 시간, 성공/실패 상태
2. **메트릭 수집**: 토큰 사용량, 응답 시간, 에러 비율
3. **로그 통합**: 여러 플랫폼(CLI, Slack, MCP)에서 일관된 로그 형식
4. **분산 추적**: 멀티 에이전트 작업 시 요청 흐름 추적

## 참고 자료

- OpenTelemetry: https://opentelemetry.io/
- Langfuse (LLM Observability): https://langfuse.com/
- CrewX 현재 로깅 시스템: `.crewx/logs/` 디렉토리

---

## Phase 3: 통합 포인트 검토

### 3.1 CrewXTool 통합 포인트 분석

CrewXTool (`packages/cli/src/crewx.tool.ts`)은 CrewX의 핵심 MCP 도구 서비스로, Observability 훅을 삽입하기에 최적의 위치입니다.

#### 3.1.1 현재 아키텍처

```
CrewXTool
├── queryAgent()       - 읽기 전용 에이전트 쿼리
├── executeAgent()     - 실행 모드 에이전트 태스크
├── queryAgentParallel()  - 병렬 쿼리
├── executeAgentParallel() - 병렬 실행
├── listAgents()       - 에이전트 목록
├── checkAIProviders() - 프로바이더 상태 확인
├── getTaskLogs()      - 태스크 로그 조회
└── clearAllLogs()     - 로그 정리
```

#### 3.1.2 핵심 통합 포인트

| 위치 | 파일:라인 | 훅 타입 | 수집 가능 데이터 |
|------|-----------|---------|-----------------|
| queryAgent 시작 | `crewx.tool.ts:623` | `onQueryStart` | agentId, query, model, platform, metadata |
| queryAgent 완료 | `crewx.tool.ts:1047` | `onQueryComplete` | success, taskId, duration, provider |
| executeAgent 시작 | `crewx.tool.ts:1138` | `onExecuteStart` | agentId, task, projectPath, model |
| executeAgent 완료 | `crewx.tool.ts:1555` | `onExecuteComplete` | success, taskId, implementation, duration |
| Provider 해석 | `crewx.tool.ts:906-936` | `onProviderResolved` | providerInput, resolvedProvider |
| 에러 발생 | `crewx.tool.ts:1073-1103` | `onError` | errorMessage, stack, agentId |

#### 3.1.3 기존 로깅 시스템 활용

현재 `TaskManagementService`를 통한 로깅이 구현되어 있습니다:

```typescript
// 현재 사용 중인 패턴 (crewx.tool.ts:708-711)
taskId = this.taskManagementService.createTask({
  type: 'query',
  provider: agentProvider,
  prompt: query,
  agentId: agentId
});
this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Started query agent ${agentDescriptor}` });
```

**Observability 확장 방안:**
1. `TaskManagementService`에 OpenTelemetry span 생성 로직 추가
2. 기존 `addTaskLog` 메서드에 메트릭 수집 훅 삽입
3. `completeTask` 메서드에 duration 계산 및 성공/실패 메트릭 추가

#### 3.1.4 ProviderBridge 통합 포인트

```typescript
// crewx.tool.ts:906-936 - Provider 해석 과정
runtimeResult = await this.providerBridgeService.createAgentRuntime({
  provider: providerInput,
  defaultAgentId: agentId,
  validAgents: agents.map(a => a.id),
});
```

**메트릭 수집 기회:**
- Provider fallback 발생 횟수
- Provider 별 성공/실패율
- Provider 해석 소요 시간

---

### 3.2 Slack 통합 포인트 분석

SlackBot (`packages/cli/src/slack/slack-bot.ts`)은 Slack 플랫폼에서 CrewXTool을 호출하는 어댑터 역할을 합니다.

#### 3.2.1 현재 아키텍처

```
SlackBot
├── Constructor: CrewXTool, ConfigService, AIProviderService 주입
├── registerHandlers()
│   ├── message event handler
│   ├── app_mention event handler
│   ├── file_shared event handler
│   └── button action handlers
├── handleCommand() - 메인 처리 로직
├── shouldRespondToMessage() - 응답 결정 로직
├── findActiveSpeaker() - 활성 스피커 결정
└── File handling methods
```

#### 3.2.2 핵심 통합 포인트

| 위치 | 파일:라인 | 훅 타입 | 수집 가능 데이터 |
|------|-----------|---------|-----------------|
| 메시지 수신 | `slack-bot.ts:289-354` | `onSlackMessageReceived` | channelId, userId, threadTs, messageType |
| 응답 결정 | `slack-bot.ts:118-225` | `onResponseDecision` | shouldRespond, reason, activeSpeaker |
| 요청 처리 시작 | `slack-bot.ts:366-425` | `onSlackRequestStart` | userRequest, threadId, mode |
| CrewXTool 호출 | `slack-bot.ts:496-504` | `onCrewXToolInvoked` | agentId, mode, contextLength |
| 응답 전송 | `slack-bot.ts:535-547` | `onSlackResponseSent` | success, agentId, taskId |
| 에러 발생 | `slack-bot.ts:573-604` | `onSlackError` | errorMessage, threadId |

#### 3.2.3 Slack 특화 메트릭

```typescript
// slack-bot.ts:496-504 - CrewXTool 호출 지점
const result = this.mode === 'execute'
  ? await this.crewXTool.executeAgent({
      ...basePayload,
      task: userRequest,
    })
  : await this.crewXTool.queryAgent({
      ...basePayload,
      query: userRequest,
    });
```

**수집 가능 Slack 특화 메트릭:**
- 채널별 요청 수
- 스레드 평균 대화 길이
- Active Speaker 전환 빈도
- 파일 다운로드 성공/실패율
- Mention-only 모드 vs 자동 응답 비율

#### 3.2.4 Thread Guard 모니터링

```typescript
// slack-bot.ts:398-410 - 중복 요청 방지
const existingGuard = this.threadGuards.get(threadId);
if (existingGuard) {
  this.logger.warn(`⚠️  Thread ${threadId} is already being processed, skipping duplicate request`);
  // ...
}
```

**모니터링 포인트:**
- 중복 요청 발생 빈도
- 동시 처리 스레드 수
- Guard 유지 시간 분포

---

### 3.3 통합 아키텍처 제안

```
┌─────────────────────────────────────────────────────────────────┐
│                    Observability Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Tracer    │  │   Metrics   │  │      Logger             │ │
│  │ (Spans)     │  │ (Counters)  │  │ (Structured Logs)       │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                     │                │
│         └────────────────┼─────────────────────┘                │
│                          │                                       │
│              ┌───────────▼───────────┐                          │
│              │  ObservabilityService │                          │
│              │  - startSpan()        │                          │
│              │  - recordMetric()     │                          │
│              │  - logEvent()         │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────▼─────┐  ┌────────▼─────┐  ┌────────▼─────┐
│   CLI Mode   │  │  MCP Server  │  │  Slack Bot   │
│              │  │              │  │              │
│ CrewXTool ◄──┼──┤  CrewXTool ◄─┼──┤  CrewXTool ◄─┤
│              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 3.4 구현 우선순위

| 우선순위 | 통합 포인트 | 난이도 | 영향도 | 비고 |
|---------|------------|--------|--------|------|
| P0 | TaskManagementService 확장 | 낮음 | 높음 | 기존 로깅 시스템 활용 |
| P1 | CrewXTool query/execute 훅 | 중간 | 높음 | 핵심 실행 경로 |
| P2 | Slack 요청/응답 훅 | 중간 | 중간 | Slack 특화 메트릭 |
| P3 | ProviderBridge 메트릭 | 낮음 | 중간 | Fallback 추적 |
| P4 | 병렬 실행 추적 | 높음 | 낮음 | 복잡한 span 구조 |

### 3.5 기술적 고려사항

#### 3.5.1 비동기 처리
- Observability 로직이 주요 실행 경로를 블로킹하지 않도록 비동기 처리 필요
- 버퍼링 및 배치 전송으로 성능 영향 최소화

#### 3.5.2 Context 전파
- CLI → CrewXTool → Provider 간 trace context 전파 필요
- Slack 메시지 → CrewXTool 호출 시 correlation ID 유지

#### 3.5.3 민감 데이터 처리
- 프롬프트/응답 내용 로깅 시 PII 마스킹 고려
- API 키, 토큰 등 민감 정보 필터링

### 3.6 결론

CrewX의 Observability 구현은 **기존 TaskManagementService를 확장**하는 것이 가장 효율적입니다.

**권장 구현 순서:**
1. `ObservabilityService` 인터페이스 정의 (Provider 패턴)
2. `TaskManagementService`에 Observability 훅 삽입
3. Slack Bot에 플랫폼 특화 메트릭 추가
4. OpenTelemetry 또는 Langfuse exporter 연동

**예상 코드 변경량:**
- `TaskManagementService`: ~100 라인 추가
- `CrewXTool`: ~50 라인 추가 (훅 호출)
- `SlackBot`: ~30 라인 추가 (Slack 특화 메트릭)
- 새 파일 `ObservabilityService`: ~200 라인
