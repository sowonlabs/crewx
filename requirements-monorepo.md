# 모노레포 요구사항

패키지 구조
- **CLI**: npm install -g crewx (기존 이름 유지, @sowonai/crewx-cli 연결, MIT 라이선스)
- **CLI**: npm install -g @sowonai/crewx-cli (새로운 이름, MIT 라이선스)
- **SDK**: npm install @sowonai/crewx-sdk (Apache-2.0 + CLA)
- **워크스페이스**: packages/cli, packages/sdk

## 지침
이 파일은 지속적으로 수정하면서 보완해 나가도록 한다.

## 디렉토리 구조
- packages/sdk
  - Apache-2.0 + CLA
  - src/, tests/, package.json, tsconfig.json, README.md
  - dist/는 CLI에서 소비할 npm 배포물
- packages/cli
  - MIT
  - src/, tests/, package.json, tsconfig.json, README.md
  - CLI 배포용 bin (dist/main.js)

## packages/sdk 세부 구조 (초안)
```
packages/sdk/
├── package.json            # name: "@sowonai/crewx-sdk", Apache-2.0 + CLA
├── tsconfig.json           # tsconfig.base.json 을 extends
├── README.md               # SDK 사용법, CLA 링크
├── src/
│   ├── index.ts            # 퍼블릭 API surface (재-export)
│   ├── config/             # YAML/환경 설정 스키마 & validator
│   ├── conversation/       # 대화 기록 관리
│   ├── core/
│   │   ├── ai/             # ai.service.ts, ai-provider.service.ts 등 오케스트레이션
│   │   ├── providers/      # base-ai.provider.ts, claude.provider.ts ...
│   │   └── tool-runtime/   # tool-call.service.ts, remote-agent.service.ts
│   ├── knowledge/          # 지식 베이스, 문서 로더
│   ├── utils/              # 공용 유틸리티, constants.ts
│   └── types/              # agent.types.ts 등 타입 정의
├── tests/
│   ├── unit/               # services/providers 단위 테스트
│   └── fixtures/           # 샘플 YAML, 템플릿 등
└── dist/                   # 빌드 산출물 (CLI 및 외부 소비)
```

### 소스 매핑 기준
- `src/services/*` → `packages/sdk/src/core` (기능별 서브 디렉터리로 재배치)
- `src/providers/*` → `packages/sdk/src/core/providers/`
- `src/conversation/*`, `src/knowledge/*`, `src/utils/*`, `src/config/*` → 동일 명칭 폴더로 이동
- `src/ai.service.ts`, `src/ai-provider.service.ts` → `packages/sdk/src/core/ai/`
- `src/agent.types.ts`, `src/constants.ts` → `packages/sdk/src/types/`, `packages/sdk/src/utils/`
- CLI 전용(`src/cli/*`, `src/slack/*`, `src/mcp.controller.ts`, `src/main.ts`) 파일은 이동하지 않고 CLI 패키지로 재배치 예정

### 공개 API 가이드
- 기본 진입점: `packages/sdk/src/index.ts`
  - 주요 export: `createCrewxAgent`, `AIService`, `BaseAIProvider`, 설정 스키마 등
  - 내부 구현 세부사항(`internal/`)은 export 금지하여 CLI 외 타 소비자가 안정적으로 사용 가능하게 유지
- 타입 정의는 `packages/sdk/src/types`에서 명시적으로 export (예: `CrewxAgentConfig`)
- CLI는 `workspace:*` 버전의 `@sowonai/crewx-sdk` 의존성으로 SDK 퍼블릭 API만 사용

### 테스트/QA 전략
- `vitest`를 활용하여 SDK 패키지 단위 테스트 독립 실행 (`npm run test --workspace @sowonai/crewx-sdk`)
- CLI와 공유하던 통합 테스트는 `packages/cli/tests`로 이전하고, SDK에는 모킹된 CLI 의존성만 둠
- 원격 에이전트, MCP 통신 등 I/O 의존 로직은 테스트에서 feature flag 또는 mock client 제공

## SDK 사용 예시 (초안)

### 기본 에이전트 실행 (query/execute)
```ts
import { createCrewxAgent } from '@sowonai/crewx-sdk';

const agent = await createCrewxAgent({
  provider: { namespace: 'cli', id: 'codex', apiKey: process.env.CODEX_TOKEN },
  knowledgeBase: { path: './docs' },
});

const queryResult = await agent.query({
  prompt: '오늘 할 일을 정리해줘',
  context: [
    '## 현재 진행중인 작업',
    '- AI 서비스 SDK 리팩토링',
    '- Slack 봇 릴리즈 준비',
  ].join('\n'),
  messages: [
    { text: '어제 진행 상황 알려줘', isAssistant: false },
    { text: '어제는 SDK 디렉토리 구조 초안을 작성했어요.', isAssistant: true },
  ],
});
console.log(queryResult.content);

const executeResult = await agent.execute({
  prompt: '새로운 기능 구현 계획을 작성해줘',
  context: '프로젝트 루트: /Users/doha/git/crewx',
});
console.log(executeResult.content);
```

### 커스텀 프로바이더 등록
```ts
import { BaseAIProvider, AIService } from '@sowonai/crewx-sdk';

class MyProvider extends BaseAIProvider {
  async respond(prompt: string) {
    return `Echo: ${prompt}`;
  }
}

const ai = new AIService({
  providers: { 'custom/my-provider': new MyProvider() },
});

const reply = await ai.queryAI('테스트', 'custom/my-provider', {
  messages: [
    { text: '이전 사용자 메시지', isAssistant: false },
    { text: '이전 도우미 응답', isAssistant: true },
  ],
  pipedContext: JSON.stringify({
    version: '1.0',
    prompt: '테스트',
    context: '샘플 컨텍스트',
    messages: [],
    metadata: { source: 'unit-test' },
  }),
});
console.log(reply.content);
```

### 구조화된 페이로드 예시
Normalize structured 커밋 이후 SDK는 `prompt`, `context`, `messages`를 자동으로 통합한 JSON 페이로드를 생성해 CLI/원격 프로바이더에 전달한다. 예시는 다음과 같다.

```json
{
  "version": "1.0",
  "agent": {
    "id": "crewx",
    "provider": "codex",
    "mode": "query",
    "model": "gpt-5-large"
  },
  "prompt": "오늘 할 일을 정리해줘",
  "context": "## 현재 진행중인 작업\n- AI 서비스 SDK 리팩토링",
  "messages": [
    {
      "id": "1760556895705-oe3d3c",
      "userId": "doha",
      "text": "어제 진행 상황 알려줘",
      "timestamp": "2025-10-15T19:34:55.705Z",
      "isAssistant": false
    },
    {
      "id": "1760556895706-ublt6b",
      "userId": "crewx",
      "text": "어제는 SDK 디렉토리 구조 초안을 작성했어요.",
      "timestamp": "2025-10-15T19:34:55.706Z",
      "isAssistant": true,
      "metadata": {
        "agent_id": "gemini"
      }
    }
  ],
  "metadata": {
    "generatedAt": "2025-02-18T03:12:45.000Z",
    "messageCount": 2,
    "originalContext": "## 현재 진행중인 작업\n- AI 서비스 SDK 리팩토링",
    "platform": "cli",
    "threadId": "th-0001",
    "callStack": [
      {
        "depth": 0,
        "agentId": "crewx",
        "provider": "codex",
        "mode": "query",
        "taskId": "task-001",
        "enteredAt": "2025-02-18T03:12:45.000Z"
      },
      {
        "depth": 1,
        "agentId": "backend",
        "provider": "claude",
        "mode": "execute",
        "taskId": "task-002",
        "enteredAt": "2025-02-18T03:12:46.120Z"
      }
    ]
  }
}
```

- `context`: stdin 파이프나 템플릿 확장 등으로 들어온 문자열이 누적된다. Normalize structured 단계에서 기존 `pipedContext`가 JSON이 아니면 자동으로 context 필드에 수렴하며, 필요 시 prompt 앞에 붙여 제공한다.
- `messages`: CLI 스레드/Slack 히스토리 등 대화 메시지를 배열 형태로 담는다. 실제 저장 포맷은 `.crewx/conversations/*.json`과 동일하게 `id`, `userId`, `timestamp`, `metadata`(예: Slack 채널, agent_id) 등을 포함한다. `isAssistant` 플래그로 사용자/도우미 메시지를 구분하며, provider 어댑터는 `MessageFormatter`(신규 공통 유틸)로 문자열을 재구성해 소비한다.
- `agent`: 현재 요청을 처리하는 최종 에이전트 정보다. `id`는 CLI에서 해석한 에이전트 식별자(`@backend` 등), `provider`는 해당 에이전트에 매핑된 실제 CLI/API 제공자 이름, `mode`는 query/execute 중 요청 타입을 의미한다.

### MessageFormatter 설계 (초안)
- **위치**: `packages/sdk/src/utils/message-formatter.ts`
- **책임**:
  - 구조화된 메시지 배열을 플랫폼별 문자열 템플릿으로 변환 (`formatHistory(messages, { platform, includeUserId })`)
  - 구조화 페이로드에서 컨텍스트 재구성 (`buildContext(payload, options)`)
  - Slack/CLI 등 플랫폼에 맞는 이모지·포맷 적용을 한 곳에서 관리
- **사용처**:
  - CLI 핸들러(`query/execute`)에서 piped 메시지를 문자열 컨텍스트로 변환
  - `CrewXTool.buildStructuredPayload`에서 `metadata.formattedHistory` 대신 호출
  - Remote provider/SDK API가 문자 기반 컨텍스트만 필요할 때
- **이점**:
  - 단일 책임 원칙 준수: 메시지 포맷 로직을 한 곳에서 재사용
  - `formattedHistory` 필드 제거 가능 (향후 완전히 제거하고 필요 시 런타임 변환)
  - 테스트 가능성 향상: 다양한 메시지/플랫폼 조합을 유닛 테스트로 검증
- **Slack 연계**:
  - SDK에 `BaseMessageFormatter` 추상 클래스를 두고, `SlackMessageFormatter`는 CLI 패키지(`packages/cli/src/slack/message-formatter.ts`)에서 상속 구현
  - Slack 전용 이모지/메타데이터(`metadata.channel`, `metadata.ts`)를 처리하고, Markdown→Slack 변환은 CLI 층에서 담당
  - 공통 로직(타임스탬프, 사용자명 표시 등)은 기본 클래스에서 제공해 코드 중복을 줄임

> 순환 참조 감지는 SDK 실행 로직에서 호출 스택을 추후 추가할 수 있도록 `metadata.threadId`, `metadata.platform` 등 최소 필드를 유지하며, 필요 시 `metadata.callStack`을 확장할 수 있는 구조로 설계한다.

### metadata.callStack 확장안 (초안)
- **필드 형태**: `callStack: Array<{ agentId: string; provider: string; mode: 'query' | 'execute'; taskId?: string; enteredAt: string; depth: number }>`
- **의미**:
  - `depth`: 루트 호출(0)부터 현재 프레임까지의 깊이
  - `enteredAt`: ISO 타임스탬프(디버깅용)
  - `taskId`: TaskManagementService가 부여한 식별자 (있을 경우)
- **활용**:
  - SDK는 호출 진입 시 프레임을 push, 종료 시 pop (실패해도 finally에서 pop)
  - 순환 발견 시 `callStack`을 그대로 에러 메시지에 포함해 체인을 보여준다
  - Remote/CLI 어댑터는 이 정보를 로그/telemetry에 활용 가능
- **호환성**:
  - optional 필드로 두고, 기존 소비자는 무시
  - 메시지 수신 측에서 순환 제어가 필요하면 `metadata.callStack` 존재 시 활용

## 추가 주의사항
- **환경 변수 분리**: Slack/CLI 전용 설정(`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, CLI 실행 플래그 등)은 `packages/cli`에서 관리하고, SDK는 순수 로직만 유지한다.
- **워크스페이스 루트 설정**: 루트 `package.json`에 `workspaces`, 공통 스크립트, `tsconfig.base.json`을 정의해 패키지별 `tsconfig.json`이 이를 extends 하도록 설계한다.
- **빌드 산출물 격리**: 각 패키지 `dist/` 경로를 독립적으로 관리하면서 `.gitignore`, 배포 스크립트(`prepack`, `postbuild`)가 패키지 루트를 기준으로 동작하는지 확인한다.
- **테스트 재배치**: Slack/CLI 통합 테스트는 `packages/cli/tests`, SDK 단위 테스트는 `packages/sdk/tests`로 분리하고, 공통 fixture는 필요 시 `packages/sdk/tests/fixtures`로 공유한다.
- **문서 업데이트**: `CREWX.md`, `docs/INDEX.md` 등에 모노레포 구조, MessageFormatter/CallStack 개념, 새로운 배포 절차가 반영되도록 동기화한다.
- **보안/인증 (CLI 전용)**: 인증/인가 가드(`BearerAuthGuard`, `AuthService`)는 CLI 패키지 전용 기능이다. MCP 서버 인증은 HTTP/전송 계층 관심사이며, SDK의 핵심 비즈니스 로직(AI 제공자, 대화 관리)과 분리된다. SDK에는 보안 관련 인터페이스를 포함하지 않으며, 다른 프로젝트는 자체 인증 메커니즘을 자유롭게 구현할 수 있다. CLI의 `packages/cli/src/guards/bearer-auth.guard.ts`와 `packages/cli/src/services/auth.service.ts`가 레퍼런스 구현을 제공한다.
- **NestJS 모듈화 주의**: SDK 코어가 NestJS 모듈이라도 Public API는 `createCrewxAgent()` 같은 추상화로 감싸 Nest 의존성을 외부에서 느끼지 않도록 설계한다. Nest-free 소비자를 위해 필요한 경우 adapter 레이어나 peerDependencies로 분리한다.
- **Nest 네임스페이스 관리**: 다른 Nest 앱과 병행 사용할 수 있도록 전역 프로바이더/모듈 이름이 충돌하지 않게 네임스페이스를 분리하고, 글로벌 파이프/필터를 등록할 때도 prefix를 준수한다.
- **YAML 입력 분리**: SDK는 에이전트 설정을 YAML 문자열/객체로 직접 전달받을 수 있도록 하고, 기본 파일 로딩(`crewx.yaml`)은 CLI 패키지 책임으로 둔다. 웹 서비스 등 다른 소비자는 파일 시스템 의존 없이 SDK를 사용할 수 있다.
- **버전 관리**: SDK와 CLI는 각각 독립 버전으로 관리하며(`@sowonai/crewx-sdk`, `crewx`). CI에서 호환성 검증은 수행하되, 버전 번호는 각 패키지 릴리즈 리듬에 맞춰 개별적으로 올린다.

## 전환 목표
- SDK를 독립 패키지로 분리하여 Apache-2.0(+CLA) 정책 준수
- CLI는 SDK를 workspace 의존성으로 사용하여 기능 재사용
- 공통 설정(tsconfig.base.json, eslint 등)을 루트에서 관리해 중복 최소화
- 루트 `package.json`은 workspaces 메타 관리 전용으로 단순화

### 병렬 처리 API (초안)
- SDK는 기존 `ParallelProcessingService`를 분리해 패키지 공개 API로 제공한다.
- 주요 메서드:
  - `runQueriesParallel(requests: AgentQueryRequest[], config?: ParallelConfig)`
  - `runExecutesParallel(requests: AgentExecuteRequest[], config?: ParallelConfig)`
  - `createTaskLogStream(taskId: string)` 등 진행 상황 모니터링용 헬퍼
- CLI는 이 API를 Thin wrapper로 감싸 CLI UX(프로그레스 바, 로그 출력)를 담당하고, 웹/Slack 등 다른 소비자는 동일 로직을 재사용한다.
- 구성 요소:
  - 공통 `ParallelConfig` 인터페이스 (동시성, 타임아웃, 재시도 정책)
  - `metadata.callStack`과 연동해 호출 체인을 추적
  - 구조화 페이로드를 그대로 전달하므로 메시지/컨텍스트 손실 없이 병렬 실행 가능
- 추후 확장:
  - 작업 큐(BullMQ 등) 연동을 위한 어댑터
  - 스트리밍 응답을 위한 EventEmitter/Observable 래퍼

## 단계별 계획 (초안)
1. **SDK 워크스페이스 추출**
   - `packages/sdk` 생성, 기존 `src/` 중 재사용 코어(services, providers, utils 등) 이동
   - SDK용 `package.json` 작성 (`name: "@sowonai/crewx-sdk"`, Apache-2.0 + CLA 안내 포함)
   - `nest-cli.json`, `tsconfig.json`을 SDK 경로 기준으로 조정, 빌드 결과를 `packages/sdk/dist`로 배포
   - 루트 CLI 코드가 SDK 빌드 산출물을 import할 수 있도록 경로/alias 재설정
2. **루트 CLI 재구성**
   - CLI 엔트리포인트, Slack/MCP 어댑터 등을 `packages/cli`로 이동
   - CLI `package.json`에서 `@sowonai/crewx-sdk`를 workspaces 버전(`workspace:*`)으로 의존
   - 글로벌 배포 스크립트(`npm install -g crewx`)가 `packages/cli`의 dist를 참조하도록 수정
3. **공통 도구 통합**
   - 루트 `package.json`에 `workspaces`, `scripts` 정의 (`npm run build --workspaces`, `npm run test --workspaces` 등)
   - 루트에 `tsconfig.base.json`, `.eslintrc.base.js` 등을 두고 패키지별에서 extends
   - GitHub Actions/CI가 패키지별 빌드·테스트를 병렬 실행하도록 조정

## 빌드 & 배포 고려사항
- 현재 `nest build` 기반 CLI 빌드 → SDK/CLI 각각 `nest` 설정 확인 필요
- `postbuild`/`postinstall` 스크립트: CLI 패키지로 이동하고 bin 경로 확인
- SDK 배포: `npm publish packages/sdk` (CLA 확인 가이드 포함), CLI 배포: `npm publish packages/cli`
- 버전 정책: 루트에서 `changeset` 또는 수동 버전 증분 방식 검토 (초기에는 수동으로도 가능)

## TODO 메모
- [ ] SDK/CLI 디렉토리 세부 구조 정의 (예: providers는 SDK, slack은 CLI)
- [ ] 경로 alias(`@/services`) → 상대 경로 또는 TS path 매핑 재정의
- [ ] 테스트/fixture가 어느 패키지에 속하는지 분류
- [ ] 문서(`CREWX.md`, `docs/INDEX.md`)를 새 구조에 맞게 업데이트

> 이 초안은 추후 작업 진행에 따라 계속 수정 예정

## 아키텍처 우려사항

### 1. 순환 의존성 위험
- **문제점**:
  - `crewx.tool.ts`(1,399줄)와 `tool-call.service.ts`(970줄) 같은 대형 파일들이 서로 복잡하게 얽혀있음
  - CLI가 SDK를 사용하고, SDK의 일부 기능이 다시 CLI 기능을 호출하는 순환 구조 발생 가능
- **영향도**: 높음 - 빌드 실패, 런타임 에러 가능
- **대응방안**:
  - 인터페이스와 구현을 명확히 분리
  - 의존성 방향을 SDK → CLI 단방향으로 엄격히 강제
  - 필요시 이벤트 기반 통신으로 전환

### 2. NestJS 강결합 문제
- **문제점**:
  - 현재 모든 서비스가 NestJS DI 컨테이너에 깊게 의존
  - SDK 사용자가 NestJS를 모르거나 사용하지 않을 수 있음
- **영향도**: 중간 - SDK 사용성 저하
- **대응방안**:
  - SDK 공개 API는 순수 TypeScript 함수로 제공
  - NestJS를 내부 구현 세부사항으로 숨김
  - Optional peer dependency로 설정

### 3. 대형 파일 분리의 복잡성
- **문제점**:
  - `crewx.tool.ts`가 MCP 프로토콜 구현과 비즈니스 로직이 혼재
  - 파일 분리 시 기능 손상 위험
- **영향도**: 높음 - 기능 장애 가능
- **대응방안**:
  - 점진적 리팩토링 (한 번에 하나씩)
  - 충분한 테스트 커버리지 확보 후 진행
  - 기능별로 작은 단위로 분리

### 4. 설정 파일 및 환경 변수 관리
- **문제점**:
  - `crewx.yaml`, 환경 변수 등이 CLI와 SDK 모두에서 필요
  - 파일 시스템 접근이 SDK에서는 제한적일 수 있음
- **영향도**: 중간
- **대응방안**:
  - SDK는 설정 객체를 직접 받도록 설계
  - CLI가 파일 읽기와 환경 변수 처리 담당
  - SDK는 순수 비즈니스 로직만 처리

### 5. 모듈 경계 정의
- **문제점**:
  - 어떤 기능이 SDK에 속하고 어떤 기능이 CLI에 속하는지 명확하지 않은 경우 존재
  - Remote agent, MCP 통신 등 경계가 모호한 영역
- **영향도**: 중간
- **대응방안**:
  - 명확한 레이어 아키텍처 정의
  - SDK: 순수 비즈니스 로직, 프로바이더 인터페이스
  - CLI: I/O, 파일 시스템, 사용자 인터페이스

### 6. 테스트 복잡성
- **문제점**:
  - 단위 테스트와 통합 테스트 재구성 필요
  - 패키지 간 통합 테스트 새로 작성
  - Mock과 실제 구현 사이의 경계 관리
- **영향도**: 중간
- **대응방안**:
  - 테스트를 먼저 이동하고 검증
  - E2E 테스트로 전체 기능 보장
  - 명확한 Mock 전략 수립

### 7. 번들 크기 및 성능
- **문제점**:
  - 워크스페이스 의존성으로 인한 중복 코드 가능성
  - 추가 추상화 레이어로 인한 오버헤드
  - Tree-shaking 효과 감소
- **영향도**: 낮음
- **대응방안**:
  - 번들 분석 도구 활용
  - Dynamic import 활용
  - 핫패스 최적화

### 8. 타입 정의 및 인터페이스 관리
- **문제점**:
  - SDK와 CLI 간 공유되는 타입 정의 관리
  - 버전 간 호환성 유지를 위한 타입 버저닝
- **영향도**: 중간
- **대응방안**:
  - 명확한 타입 export 정책
  - Breaking change 최소화를 위한 타입 확장 전략
  - `@internal` 주석으로 내부 API 구분

### 참고: 병렬 실행 동작 방식
- `ParallelConfig.concurrency`는 동시에 실행할 최대 요청 수를 의미한다. 예를 들어 10개의 query를 요청하고 `concurrency: 2`로 설정하면, 두 개씩 동시에 실행되며 총 5번의 배치로 처리된다.
- 모든 요청이 작업 큐에 들어가고, 현재 실행 중인 요청이 완료될 때마다 대기 중인 요청이 순차적으로 시작된다.
- `timeoutMs`, 재시도 정책 등을 함께 조정하면 배치 처리와 오류 복구 전략을 세밀하게 제어할 수 있다.

### SDK 사용 예시 (코드 스케치)
```ts
// 1. YAML 문자열로 에이전트 구성
import { createCrewxAgent, loadAgentConfigFromYaml } from '@sowonai/crewx-sdk';

const yamlConfig = `
agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus
`;

const config = loadAgentConfigFromYaml(yamlConfig);
const { agent } = await createCrewxAgent({ config });

const result = await agent.query({
  agentId: 'backend',
  prompt: 'API 설계 검토해줘',
  context: '프로젝트 루트: /Users/doha/git/crewx',
});
console.log(result.content);
```

```ts
// 2. 병렬 Query/Execute 실행
import {
  runQueriesParallel,
  runExecutesParallel,
  ParallelConfig,
} from '@sowonai/crewx-sdk';

const parallelConfig: ParallelConfig = { concurrency: 2, timeoutMs: 60_000 };

const queryResults = await runQueriesParallel(
  [
    {
      agentId: 'frontend',
      prompt: '디자인 시스템 점검',
      context: 'UI 라이브러리: Tailwind',
    },
    {
      agentId: 'infra',
      prompt: 'Kubernetes 배포 파이프라인 검토',
    },
  ],
  parallelConfig,
);

const executeResults = await runExecutesParallel(
  [
    {
      agentId: 'devops',
      prompt: 'CI 파이프라인 최적화 계획 작성',
    },
    {
      agentId: 'backend',
      prompt: '신규 API 초안 문서화',
    },
  ],
  { concurrency: 1, timeoutMs: 120_000 },
);

console.log(queryResults.map(r => [r.agentId, r.success]));
console.log(executeResults.map(r => [r.agentId, r.success]));
```

```ts
// 3. 커스텀 메시지 포맷터 (Slack 전용)
import {
  BaseMessageFormatter,
  StructuredMessage,
} from '@sowonai/crewx-sdk';

class SlackMessageFormatter extends BaseMessageFormatter {
  formatHistory(messages: StructuredMessage[]): string {
    return messages
      .map(msg => {
        const prefix = msg.isAssistant ? ':robot_face:' : ':bust_in_silhouette:';
        return `${prefix} *${msg.userId ?? 'User'}*: ${msg.text}`;
      })
      .join('\n');
  }
}

const agent = await createCrewxAgent({
  formatter: new SlackMessageFormatter(),
});
```

```ts
// 4. callStack 이벤트 구독
import { createCrewxAgent } from '@sowonai/crewx-sdk';

const { agent, onEvent } = await createCrewxAgent({ enableCallStack: true });

onEvent('callStackUpdated', stack => {
  console.log(stack.map(frame => `${frame.depth}: ${frame.agentId}`));
});

await agent.execute({
  agentId: 'backend',
  prompt: '신규 기능 구현 계획 작성',
});
```
