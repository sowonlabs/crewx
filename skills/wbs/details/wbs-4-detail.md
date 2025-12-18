# Observability 구현 가능성 검토

## 개요

CrewX의 AI 에이전트 실행 모니터링 및 관찰 가능성(Observability) 기능 구현을 위한 통합 포인트 분석 문서입니다.

## 요구사항

- AI 에이전트 실행 추적 (Task 시작/완료/실패)
- 성능 메트릭 수집 (응답 시간, 토큰 사용량)
- 플랫폼별 컨텍스트 추적 (CLI, Slack, MCP)
- 로그 중앙화 및 구조화

## 참고 자료

- packages/cli/src/crewx.tool.ts - CrewXTool 핵심 로직
- packages/cli/src/slack/slack-bot.ts - Slack 통합
- packages/cli/src/conversation/slack-conversation-history.provider.ts - 대화 히스토리

---

## Phase 2: 기술 스택 검토

### 1. better-sqlite3 기술 분석

#### 1.1 라이브러리 개요

| 항목 | 내용 |
|------|------|
| **패키지 이름** | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| **현재 버전** | 11.x (2024-2025 기준) |
| **Node.js 요구사항** | v14.21.1 이상 (LTS 버전 prebuilt binaries 제공) |
| **라이선스** | MIT |
| **타입 정의** | `@types/better-sqlite3` |

#### 1.2 핵심 특성

**동기 API (Synchronous API)**
- 콜백/Promise 없이 동기적으로 실행
- Event loop 복잡성 제거
- 코드 가독성 및 디버깅 용이

```typescript
// better-sqlite3 예시 (동기)
const db = new Database('.crewx/traces.db');
const stmt = db.prepare('SELECT * FROM traces WHERE agent_id = ?');
const rows = stmt.all('claude');  // 동기적으로 즉시 결과 반환
```

**성능 특성**
- node-sqlite3 대비 대부분의 케이스에서 더 빠름
- 네이티브 바인딩으로 최소 오버헤드
- 단일 스레드 환경에서 최적화됨

#### 1.3 CrewX 적합성 분석

| 평가 항목 | 상태 | 근거 |
|----------|------|------|
| **성능** | ✅ 적합 | 로컬 파일 기반, 소-중규모 데이터 |
| **동기 API** | ✅ 적합 | NestJS 서비스에서 간단한 사용 |
| **Node.js 호환** | ✅ 적합 | Node.js 18+ 완전 지원 |
| **타입 안전성** | ✅ 적합 | TypeScript 타입 정의 제공 |
| **번들 크기** | ⚠️ 주의 | 네이티브 모듈 포함 (~5MB) |

#### 1.4 제한사항 및 주의점

1. **동시 쓰기 제한**: 한 번에 하나의 writer만 가능
2. **네이티브 모듈**: 플랫폼별 빌드 필요 (prebuilt 제공)
3. **메모리**: 대용량 쿼리 시 메모리 사용 증가 가능
4. **네트워크 불가**: 네트워크 파일시스템에서 WAL 사용 불가

---

### 2. WAL (Write-Ahead Logging) 모드 분석

#### 2.1 WAL 모드 개요

WAL(Write-Ahead Logging)은 SQLite 3.7.0부터 도입된 저널 모드로, 기존 롤백 저널 방식 대비 현저히 개선된 동시성과 성능을 제공합니다.

**작동 원리**
```
기존 롤백 모드:
  Write → Main DB 수정 → Rollback Journal에 원본 백업

WAL 모드:
  Write → WAL 파일에 새 데이터 추가 → Main DB는 그대로 유지
  Read → Main DB + WAL 파일 조합하여 최신 데이터 반환
```

#### 2.2 WAL 모드 설정

```sql
-- WAL 모드 활성화 (설계 문서 기준)
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;  -- 5초 대기
```

```typescript
// better-sqlite3에서 WAL 활성화
import Database from 'better-sqlite3';

const db = new Database('.crewx/traces.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
```

#### 2.3 WAL 모드 장점

| 장점 | 설명 | CrewX 관련성 |
|------|------|-------------|
| **동시 읽기/쓰기** | Reader가 Writer를 블로킹하지 않음 | CLI와 Slack Bot 동시 실행 시 유용 |
| **성능 향상** | 쓰기 시 순차적 I/O, fsync 감소 | Trace 기록 시 오버헤드 최소화 |
| **안정성** | 충돌 시 데이터 손실 위험 감소 | 프로덕션 환경에서 안정적 |
| **ACID 보장** | 트랜잭션 무결성 완전 지원 | 데이터 일관성 확보 |

#### 2.4 WAL 모드 제한사항

| 제한사항 | 영향 | 대응 방안 |
|----------|------|----------|
| **네트워크 FS 불가** | NFS, SMB에서 사용 불가 | 로컬 `.crewx/` 디렉토리 사용 (해당 없음) |
| **단일 Writer** | 동시 쓰기 시 대기 필요 | `busy_timeout=5000` 설정 |
| **WAL 파일 크기** | 체크포인트 전까지 증가 | 자동 체크포인트 (1000 pages) |
| **공유 메모리** | wal-index용 shm 파일 필요 | 자동 관리됨 |

#### 2.5 동시성 시나리오 분석

**CrewX 사용 시나리오**:
1. CLI에서 `crewx query` 실행 → Trace 기록
2. Slack Bot에서 메시지 처리 → 동시에 Trace 기록
3. `crewx trace ls` 실행 → 동시에 읽기

```
시나리오: CLI + Slack Bot 동시 접근

WAL 모드 적용 시:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CLI Write  │     │ Slack Write │     │   CLI Read  │
│  (Trace)    │     │  (Trace)    │     │ (trace ls)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
   ┌───────────────────────────────────────────────┐
   │              traces.db (WAL mode)              │
   │  - Writer 1: 즉시 WAL에 기록                   │
   │  - Writer 2: busy_timeout 동안 대기 후 기록    │
   │  - Reader: Writer와 병렬로 읽기 가능           │
   └───────────────────────────────────────────────┘
```

#### 2.6 busy_timeout 설정 검토

설계 문서의 `busy_timeout=5000` (5초) 평가:

| 평가 항목 | 상태 | 근거 |
|----------|------|------|
| **일반 사용** | ✅ 충분 | 대부분의 write 작업은 수 밀리초 |
| **고부하 시나리오** | ⚠️ 주의 | 대량 Trace 동시 기록 시 10초+ 권장 |
| **에러 핸들링** | ✅ 필요 | SQLITE_BUSY 에러 처리 로직 필요 |

**권장 설정**:
```typescript
db.pragma('busy_timeout = 5000');     // 기본값 (설계 문서와 동일)
// 또는
db.pragma('busy_timeout = 10000');    // 고부하 환경에서 권장
```

---

### 3. 기술적 실현 가능성 평가

#### 3.1 종합 평가

| 평가 영역 | 상태 | 점수 | 비고 |
|----------|------|------|------|
| **better-sqlite3 도입** | ✅ GREEN | 9/10 | Node.js 환경에 최적 |
| **WAL 모드 적용** | ✅ GREEN | 9/10 | 동시성 요구사항 충족 |
| **NestJS 통합** | ✅ GREEN | 8/10 | DI 패턴과 호환 |
| **성능 영향** | ✅ GREEN | 9/10 | 오버헤드 최소화 가능 |
| **유지보수성** | ✅ GREEN | 8/10 | 동기 API로 코드 단순화 |

**최종 판정: ✅ 기술적으로 실현 가능 (GREEN)**

#### 3.2 구현 권장사항

1. **초기화 시 WAL 설정**
   ```typescript
   // TracingService 초기화 시
   private initDatabase(): void {
     this.db = new Database(this.dbPath);
     this.db.pragma('journal_mode = WAL');
     this.db.pragma('busy_timeout = 5000');
     this.db.pragma('synchronous = NORMAL');  // 성능 최적화
   }
   ```

2. **에러 핸들링**
   ```typescript
   try {
     stmt.run(data);
   } catch (error) {
     if (error.code === 'SQLITE_BUSY') {
       // 재시도 로직 또는 큐잉
     }
     throw error;
   }
   ```

3. **주기적 체크포인트** (선택사항)
   ```typescript
   // 대량 쓰기 후 수동 체크포인트
   db.pragma('wal_checkpoint(TRUNCATE)');
   ```

#### 3.3 Devil's Advocate: 잠재적 문제점

| 문제 | 가능성 | 영향 | 대응 방안 |
|------|--------|------|----------|
| **WAL 파일 비정상 증가** | 낮음 | 디스크 사용 증가 | `crewx trace clean` 명령어로 관리 |
| **동시 쓰기 대기 타임아웃** | 낮음 | 일부 Trace 누락 | `busy_timeout` 증가 또는 비동기 큐 |
| **shm/wal 파일 잠금** | 매우 낮음 | 프로세스 종료 시 정리 | OS가 자동 정리 |
| **네이티브 모듈 호환성** | 낮음 | 빌드 실패 | prebuilt binaries 사용 |

---

### 4. 결론

#### 4.1 기술 스택 승인 권장

- **better-sqlite3**: CrewX 환경에 적합, 동기 API로 코드 단순화 가능
- **WAL 모드**: CLI/Slack Bot 동시 접근 시나리오에 필수
- **busy_timeout=5000**: 기본값으로 적절, 필요시 증가 가능

#### 4.2 다음 단계

- Phase 3: 통합 포인트 검토 (완료됨)
- Phase 4: ObservabilityService 인터페이스 설계
- Phase 5: 실제 구현 및 테스트

---

*기술 스택 검토 완료: 2025-12-18*
*WBS: wbs-4 / Job: job-8*

---

## Phase 3: 통합 포인트 검토

### 1. CrewXTool 통합 포인트

#### 1.1 핵심 메서드 구조

| 메서드 | 위치 | 역할 | Observability 관련 |
|--------|------|------|-------------------|
| `queryAgent()` | crewx.tool.ts:623-1104 | 읽기 전용 에이전트 쿼리 | TaskManagementService 통해 추적 중 |
| `executeAgent()` | crewx.tool.ts:1138-1608 | 파일 수정 가능한 실행 | TaskManagementService 통해 추적 중 |
| `queryAgentParallel()` | crewx.tool.ts:1773-1946 | 병렬 쿼리 실행 | 개별 쿼리별 추적 |
| `executeAgentParallel()` | crewx.tool.ts:1981-2180 | 병렬 실행 | 개별 태스크별 추적 |

#### 1.2 기존 추적 메커니즘

```typescript
// TaskManagementService를 통한 태스크 추적 (crewx.tool.ts:701-708)
taskId = this.taskManagementService.createTask({
  type: 'query',
  provider: agentProvider,
  prompt: query,
  agentId: agentId
});
this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Started query agent ${agentDescriptor}` });
```

#### 1.3 Observability 확장 포인트

| 포인트 | 파일:라인 | 현재 상태 | 확장 가능성 |
|--------|----------|----------|------------|
| Task 생성 | crewx.tool.ts:701-708 | `createTask()` 호출 | OpenTelemetry span 시작점 |
| Task 완료 | crewx.tool.ts:1047-1048 | `completeTask()` 호출 | span 종료 + 메트릭 수집 |
| Provider 해석 | crewx.tool.ts:906-936 | 로그만 기록 | 추적 가능한 context 전파 |
| 에러 처리 | crewx.tool.ts:1073-1102 | 로그 + completeTask | 에러 메트릭 + 알림 |

#### 1.4 플랫폼 메타데이터 전달

```typescript
// crewx.tool.ts:831-834 - 플랫폼 정보가 이미 전달됨
const templateContext: RenderContext = {
  // ...
  platform: platform, // Pass platform information (slack/cli)
  metadata: metadata, // Pass platform-specific metadata (e.g., Slack channel_id, thread_ts)
};
```

**현재 전달되는 메타데이터:**
- `platform`: 'cli' | 'slack'
- `metadata.channel_id`: Slack 채널 ID
- `metadata.thread_ts`: Slack 스레드 타임스탬프

---

### 2. Slack 통합 포인트

#### 2.1 SlackBot 클래스 구조 (slack-bot.ts)

| 컴포넌트 | 역할 | Observability 관련 |
|----------|------|-------------------|
| `SlackBot` | Slack 이벤트 처리 | 메시지 이벤트 → CrewXTool 호출 |
| `SlackConversationHistoryProvider` | 대화 히스토리 관리 | 컨텍스트 추적에 유용 |
| `SlackFileDownloadService` | 파일 다운로드 | 파일 처리 추적 |
| `SlackMessageFormatter` | 응답 포맷팅 | - |

#### 2.2 CrewXTool 호출 지점

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

**전달되는 컨텍스트 (slack-bot.ts:485-494):**
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
```

#### 2.3 Slack 특화 추적 포인트

| 포인트 | 파일:라인 | 현재 상태 | 확장 가능성 |
|--------|----------|----------|------------|
| 메시지 수신 | slack-bot.ts:314 | 디버그 로그 | Incoming request span |
| Bot 응답 결정 | slack-bot.ts:118-225 | 로그만 기록 | Decision 메트릭 |
| CrewXTool 호출 | slack-bot.ts:496-504 | 결과만 기록 | 전체 요청-응답 span |
| 응답 전송 | slack-bot.ts:535-547 | metadata 포함 | Response 메트릭 |
| Reaction 업데이트 | slack-bot.ts:559-572 | try-catch | UI 피드백 추적 |

#### 2.4 Active Speaker 로직 (Observability 연관)

```typescript
// slack-bot.ts:242-285 - findActiveSpeaker()
// Slack 스레드에서 마지막 응답 봇을 추적하는 로직
// → 멀티 에이전트 환경에서 어떤 에이전트가 응답했는지 추적에 활용 가능
```

---

### 3. 대화 히스토리 추적

#### 3.1 SlackConversationHistoryProvider 구조

| 메서드 | 역할 | Observability 관련 |
|--------|------|-------------------|
| `fetchHistory()` | Slack API에서 스레드 히스토리 조회 | 컨텍스트 크기 추적 |
| `formatForAI()` | AI 입력용 포맷팅 | 토큰 추정에 활용 |
| `invalidateCache()` | 캐시 무효화 | 캐시 히트/미스 메트릭 |
| `persistThread()` | 로컬 저장 | 저장 성공/실패 추적 |

#### 3.2 메시지 메타데이터 구조

```typescript
// slack-conversation-history.provider.ts:193-231
{
  id: msg.ts,
  userId: msg.bot_id ? 'assistant' : msg.user,
  text: this.sanitizeMessage(...),
  timestamp: new Date(...),
  isAssistant: !!msg.bot_id,
  files: [...],
  metadata: {
    ts: msg.ts,
    thread_ts: msg.thread_ts,
    agent_id: agentId,
    provider: msg.metadata?.event_payload?.provider || agentId,
    slack: {
      user_id: msg.user,
      username: userInfo?.name,
      user_profile: {...},
      bot_id: msg.bot_id,
      bot_profile: {...},
      bot_user_id: botInfo?.userId,
      bot_username: botInfo?.username,
    }
  }
}
```

---

### 4. Observability 구현 권장사항

#### 4.1 최소 변경으로 추가 가능한 메트릭

1. **Task 실행 메트릭** (TaskManagementService 확장)
   - 실행 시간 (start → complete)
   - 성공/실패 비율
   - 에이전트별 사용량

2. **플랫폼별 메트릭**
   - Slack: thread 길이, 응답 시간, 파일 처리 횟수
   - CLI: 명령어 빈도, 병렬 실행 비율
   - MCP: 도구 호출 빈도

3. **Provider 메트릭**
   - Provider별 응답 시간
   - Fallback 발생 빈도
   - 모델별 사용량

#### 4.2 구현 우선순위

| 우선순위 | 항목 | 난이도 | 영향도 |
|----------|------|--------|--------|
| 1 | TaskManagementService에 메트릭 수집 추가 | 낮음 | 높음 |
| 2 | CrewXTool에 OpenTelemetry span 삽입 | 중간 | 높음 |
| 3 | Slack 플랫폼 특화 메트릭 | 중간 | 중간 |
| 4 | 대화 컨텍스트 크기 추적 | 낮음 | 낮음 |

#### 4.3 아키텍처 권장사항

```
┌─────────────────────────────────────────────────────────────┐
│                    Observability Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ObservabilityService                                        │
│  ├── startSpan(name, attributes)                            │
│  ├── endSpan(spanId, status)                                │
│  ├── recordMetric(name, value, labels)                      │
│  └── logStructured(level, message, context)                 │
├─────────────────────────────────────────────────────────────┤
│                    Integration Points                        │
├──────────────┬──────────────┬───────────────────────────────┤
│  CrewXTool   │  SlackBot    │  TaskManagementService        │
│  - queryAgent│  - handleCmd │  - createTask                 │
│  - execAgent │  - respond   │  - completeTask               │
│  - parallel  │  - files     │  - addTaskLog                 │
└──────────────┴──────────────┴───────────────────────────────┘
```

---

### 5. 결론

#### 5.1 현재 상태 요약

- **강점**: TaskManagementService를 통한 기본적인 태스크 추적이 이미 구현됨
- **강점**: 플랫폼 메타데이터가 CrewXTool까지 잘 전달됨
- **개선점**: 구조화된 메트릭 수집 체계 부재
- **개선점**: 분산 추적(distributed tracing) 미지원

#### 5.2 다음 단계

1. **Phase 4**: ObservabilityService 인터페이스 설계
2. **Phase 5**: TaskManagementService 확장
3. **Phase 6**: 플랫폼별 메트릭 수집 구현
4. **Phase 7**: 대시보드/알림 연동

---

*분석 완료: 2025-12-18*
*WBS: wbs-4 / Job: job-9*
