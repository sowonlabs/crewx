[< WBS 개요](../wbs.md)

# WBS-4 Job-9: 통합 포인트 검토 (CrewXTool, Slack)

## 검토 개요

| 항목 | 내용 |
|------|------|
| WBS | wbs-4 |
| Job | job-9 |
| 브랜치 | feature/wbs-4-9 |
| 검토일 | 2025-12-18 |
| 검토자 | @crewx_claude_dev |

## 1. CrewXTool 통합 포인트 분석

### 1.1 파일 위치
- `packages/cli/src/crewx.tool.ts` (2263 lines)

### 1.2 주요 MCP Tools

| Tool Name | 설명 | Mode |
|-----------|------|------|
| `crewx_getTaskLogs` | Task 로그 조회 | Read-only |
| `crewx_checkAIProviders` | AI 프로바이더 상태 확인 | Read-only |
| `crewx_listAgents` | 사용 가능한 에이전트 목록 | Read-only |
| `crewx_queryAgent` | 에이전트 쿼리 (읽기 전용) | Read-only |
| `crewx_executeAgent` | 에이전트 실행 (파일 수정 가능) | Execute |
| `crewx_queryAgentParallel` | 병렬 쿼리 | Read-only |
| `crewx_executeAgentParallel` | 병렬 실행 | Execute |
| `crewx_clearAllLogs` | 로그 정리 | Execute |

### 1.3 핵심 통합 포인트

#### 1.3.1 Template Context 생성 (Line 754-780)
```typescript
const templateContext: RenderContext = {
  user_input: query,
  messages: contextMessages,
  agent: { ... },
  documents,
  vars: { security_key: securityKey },
  props: {},
  mode: 'query' | 'execute',
  platform: 'cli' | 'slack',
  metadata: { channel_id, thread_ts },  // Slack 메타데이터
  env: process.env,
  tools: this.buildToolsContext(),
};
```

#### 1.3.2 Slack 플랫폼 지원
- `platform` 필드: `'cli' | 'slack'` 지원
- `metadata` 필드: Slack 전용 메타데이터 (channel_id, thread_ts) 전달
- `messages` 필드: 대화 히스토리 (Slack 스레드 포함)

#### 1.3.3 Structured Payload Builder (Line 58-113)
```typescript
private async buildStructuredPayload(params: {
  agentId: string;
  provider: string;
  mode: 'query' | 'execute';
  prompt: string;
  context?: string;
  messages?: Array<{...}>;
  platform?: 'cli' | 'slack';
  model?: string;
  platformMetadata?: Record<string, any>;  // Slack 메타데이터 포함
}): Promise<string>
```

### 1.4 의존성 서비스

| 서비스 | 역할 |
|--------|------|
| `AIService` | AI 프로바이더 가용성 확인 |
| `AIProviderService` | 프로바이더 인스턴스 관리 |
| `ProviderBridgeService` | 프로바이더 브릿지 (CLI/API 통합) |
| `AgentLoaderService` | 에이전트 설정 로딩 |
| `DocumentLoaderService` | 문서 템플릿 로딩 |
| `TemplateService` | 템플릿 처리 |
| `SkillLoaderService` | 스킬 로딩 |
| `TaskManagementService` | Task 로깅 및 추적 |

---

## 2. Slack 통합 포인트 분석

### 2.1 관련 파일

| 파일 | 역할 |
|------|------|
| `packages/cli/src/slack/slack-bot.ts` | Slack Bot 메인 핸들러 |
| `packages/cli/src/conversation/slack-conversation-history.provider.ts` | Slack 대화 히스토리 관리 |
| `packages/cli/src/slack/services/slack-file-download.service.ts` | Slack 파일 다운로드 |
| `packages/cli/src/slack/formatters/message.formatter.ts` | 메시지 포맷팅 |

### 2.2 SlackBot → CrewXTool 통합

#### 2.2.1 메시지 처리 흐름
```
Slack Event → SlackBot.handleCommand() → CrewXTool.queryAgent() / executeAgent()
```

#### 2.2.2 통합 호출 코드 (slack-bot.ts:485-504)
```typescript
const basePayload = {
  agentId: this.defaultAgent,
  context: contextText || undefined,
  messages: conversationMessages.length > 0 ? conversationMessages : undefined,
  platform: 'slack' as const,
  metadata: {
    channel_id: message.channel,
    thread_ts: threadTs,
  },
};

const result = this.mode === 'execute'
  ? await this.crewXTool.executeAgent({ ...basePayload, task: userRequest })
  : await this.crewXTool.queryAgent({ ...basePayload, query: userRequest });
```

### 2.3 대화 히스토리 통합

#### 2.3.1 SlackConversationHistoryProvider 핵심 기능
- `fetchHistory(threadId)`: Slack API에서 스레드 히스토리 조회
- `formatForAI(thread)`: AI 모델용 포맷팅
- `invalidateCache(threadId)`: 캐시 무효화
- `enableLocalLogging()`: 로컬 저장 활성화

#### 2.3.2 메시지 변환 (slack-conversation-history.provider.ts:153-234)
```typescript
const messages: ConversationMessage[] = result.messages.map((msg) => ({
  id: msg.ts,
  userId: msg.bot_id ? 'assistant' : msg.user,
  text: this.sanitizeMessage(this.extractMessageContent(msg)),
  timestamp: new Date(parseFloat(msg.ts) * 1000),
  isAssistant: !!msg.bot_id,
  files,
  metadata: {
    ts: msg.ts,
    thread_ts: msg.thread_ts,
    agent_id: agentId,
    provider: msg.metadata?.event_payload?.provider,
    slack: { user_id, username, user_profile, bot_id, bot_profile },
  },
}));
```

### 2.4 Active Speaker 모델

#### 2.4.1 개념
- 스레드에서 마지막으로 응답한 봇이 "active speaker"가 됨
- Active speaker만 후속 메시지에 자동 응답
- 멘션으로 봇 전환 가능

#### 2.4.2 구현 (slack-bot.ts:242-285)
```typescript
private findActiveSpeaker(messages: any[]): string | null {
  // 1. metadata.event_payload.agent_id
  // 2. bot_profile.name
  // 3. 메시지 텍스트에서 @agent_name 파싱
  // 4. bot_id 매칭 시 defaultAgent 사용
}
```

---

## 3. 테스트 커버리지 현황

### 3.1 CrewXTool 테스트

| 테스트 파일 | 커버리지 |
|-------------|----------|
| `packages/cli/tests/unit/crewx.tool.spec.ts` | 확인 필요 |

### 3.2 Slack 통합 테스트

| 테스트 파일 | 커버리지 |
|-------------|----------|
| `packages/cli/tests/integration/slack/` | 확인 필요 |

---

## 4. 발견된 통합 포인트 요약

### 4.1 데이터 흐름

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  Slack API  │─────▶│  SlackBot            │─────▶│  CrewXTool      │
│             │      │  - handleCommand()   │      │  - queryAgent() │
│             │      │  - handleMessage()   │      │  - executeAgent()│
└─────────────┘      └──────────────────────┘      └─────────────────┘
       │                      │                            │
       │                      ▼                            │
       │             ┌──────────────────────┐              │
       │             │  SlackConversation   │              │
       │             │  HistoryProvider     │              │
       │             │  - fetchHistory()    │              │
       └────────────▶│  - formatForAI()     │──────────────┘
                     └──────────────────────┘
```

### 4.2 핵심 인터페이스

#### 4.2.1 queryAgent / executeAgent 입력
```typescript
interface AgentCallInput {
  agentId: string;
  query?: string;       // queryAgent용
  task?: string;        // executeAgent용
  context?: string;
  model?: string;
  messages?: Array<{
    text: string;
    isAssistant: boolean;
    metadata?: Record<string, any>;
    files?: any[];
  }>;
  platform?: 'cli' | 'slack';
  metadata?: Record<string, any>;  // Slack: { channel_id, thread_ts }
}
```

#### 4.2.2 응답 형식
```typescript
interface AgentCallOutput {
  content: Array<{ type: string; text: string }>;
  success: boolean;
  agent: string;
  provider: string;
  taskId: string;
  error?: string;
  readOnlyMode?: boolean;
  implementation?: string;  // executeAgent의 실제 응답
}
```

---

## 5. 권장 테스트 시나리오

### 5.1 단위 테스트
- [ ] CrewXTool.queryAgent() - Slack platform 지원
- [ ] CrewXTool.executeAgent() - Slack platform 지원
- [ ] buildStructuredPayload() - platformMetadata 처리
- [ ] processAgentSystemPrompt() - metadata 전달

### 5.2 통합 테스트
- [ ] SlackBot → CrewXTool 전체 흐름
- [ ] Slack 대화 히스토리 → messages 변환
- [ ] Active Speaker 로직
- [ ] 파일 다운로드 통합

### 5.3 E2E 테스트
- [ ] Slack 멘션 → 응답 전체 흐름
- [ ] 스레드 대화 히스토리 유지
- [ ] 봇 전환 (Active Speaker 변경)

---

## 6. 결론

### 6.1 통합 상태 평가

| 항목 | 상태 | 비고 |
|------|------|------|
| CrewXTool Slack 지원 | ✅ 완료 | platform, metadata 필드 완전 지원 |
| 대화 히스토리 통합 | ✅ 완료 | messages 필드로 전달 |
| 파일 첨부 지원 | ✅ 완료 | files 필드로 전달 |
| Active Speaker 모델 | ✅ 완료 | findActiveSpeaker() 구현됨 |
| 테스트 커버리지 | 🔶 확인 필요 | 통합 테스트 보강 권장 |

### 6.2 개선 권장 사항

1. **테스트 보강**: Slack 통합 관련 단위/통합 테스트 추가
2. **에러 핸들링**: Slack API 실패 시 graceful degradation 강화
3. **문서화**: Slack 통합 아키텍처 문서 업데이트

---

## 변경 이력

| 날짜 | 작성자 | 내용 |
|------|--------|------|
| 2025-12-18 | @crewx_claude_dev | 최초 작성 - 통합 포인트 검토 완료 |
