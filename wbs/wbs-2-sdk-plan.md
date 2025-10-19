[← WBS 개요](../wbs.md)

# WBS-2: SDK 패키지 분리 및 코드 이동 작업 계획

## 목표
- `packages/sdk`로 재사용 가능한 핵심 비즈니스 로직 분리
- Apache-2.0 + CLA 라이선스 적용
- NestJS 의존성을 내부로 캡슐화하고 순수 TypeScript API 제공

## 선행 조건
- [x] WBS-1: 워크스페이스 구조 설정 완료
- [x] `packages/sdk` 디렉토리 생성
- [x] SDK용 `package.json` 기본 설정

## Phase 1: 기초 구조 및 의존성 없는 코드 이동 (Day 1-2)

### 1.1 SDK 디렉토리 구조 생성
```
packages/sdk/src/
├── index.ts           # 공개 API 진입점
├── types/             # 타입 정의
├── utils/             # 유틸리티 함수
├── constants/         # 상수 정의
└── config/            # 설정 관련
```

### 1.2 의존성 없는 파일 이동 (우선순위 순)
- [x] `src/agent.types.ts` → `packages/sdk/src/types/agent.types.ts`
- [x] `src/constants.ts` → `packages/sdk/src/constants/index.ts`
- [x] `src/utils/string-utils.ts` → `packages/sdk/src/utils/string-utils.ts`
- [x] `src/utils/math-utils.ts` → `packages/sdk/src/utils/math-utils.ts`
- [x] `src/utils/error-utils.ts` → `packages/sdk/src/utils/error-utils.ts`
- [x] `src/utils/mention-parser.ts` → `packages/sdk/src/utils/mention-parser.ts`
- [x] `src/config/timeout.config.ts` → `packages/sdk/src/config/timeout.config.ts`

> 참고: CLI는 `@sowonai/crewx-sdk` 경로(path alias + workspace dependency)로 타입/유틸/상수를 참조합니다.

### 1.3 SDK package.json 의존성 추가
```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0",
    "js-yaml": "^4.1.0",
    "ajv": "^8.17.1"
  },
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0"
  }
}
```

### 1.4 초기 빌드 테스트
- [x] `npm run build -w @sowonai/crewx-sdk` 성공 확인
- [x] 타입 정의 파일(.d.ts) 생성 확인

### 1.5 CLI 경로 전환 & 공유 유틸 의존성 정리
- [x] 루트 `tsconfig.base.json`에 `@sowonai/crewx-sdk` path alias 추가
- [x] CLI 종속성 `@sowonai/crewx-sdk` workspace 링크 추가 (`packages/cli/package.json`)
- [x] CLI import 경로를 `@sowonai/crewx-sdk`로 업데이트 (`AgentInfo`, `getErrorMessage`, `SERVER_NAME` 등)

## Phase 2: Provider 인터페이스 정의 (✅ 완료, Day 2-3)

### 2.1 Core 디렉토리 구조 생성
```
packages/sdk/src/core/
├── providers/         # Provider 인터페이스 및 타입 정의
└── (future) ai/       # AI 오케스트레이션 (Phase 5+)
```

### 2.2 Provider 인터페이스 이동 (SDK)
- [x] `src/providers/ai-provider.interface.ts` → `packages/sdk/src/core/providers/ai-provider.interface.ts`
  - `AIProvider` 인터페이스
  - `AIQueryOptions`, `AIResponse` 타입
  - `ProviderNotAvailableError` 에러 클래스
  - SDK 소비자가 커스텀 Provider를 정의할 수 있는 계약(contract) 제공

### 2.3 Provider 구현체 (CLI에 유지)
**결정사항**: Provider 구현체는 CLI에 유지하는 것이 올바른 아키텍처
- **CLI에 유지**: `base-ai.provider.ts`, `claude.provider.ts`, `gemini.provider.ts`, `copilot.provider.ts`, `codex.provider.ts`
- **CLI에 유지**: `dynamic-provider.factory.ts` (ConfigService 의존)

**이유**:
1. Provider 구현체는 CLI 도구에 직접 의존 (`spawn`, `exec` 사용)
2. `DynamicProviderFactory`는 ConfigService 의존 (YAML 설정)
3. SDK는 인터페이스만 제공하여 느슨한 결합 유지
4. SDK 소비자는 자신만의 Provider 구현 가능 (예: API 기반 Provider)

### 2.4 SDK Export 확인
- [x] `packages/sdk/src/index.ts`에서 Provider 인터페이스 export
  ```typescript
  export * from './core/providers/ai-provider.interface';
  ```

## Phase 3: 대화 및 지식 관리 이동 (Day 3-4)

### 3.1 Conversation 모듈 구조
```
packages/sdk/src/conversation/
├── interfaces/
│   └── conversation-history.interface.ts
├── providers/
│   └── base-conversation-history.provider.ts
└── services/
    └── conversation-storage.service.ts
```

### 3.2 Conversation 파일 이동
- [x] `src/conversation/conversation-history.interface.ts` → SDK
- [ ] `src/conversation/base-conversation-history.provider.ts` → SDK
- [x] `src/conversation/conversation-storage.service.ts` → SDK
- [x] `src/conversation/conversation-config.ts` → SDK
- [ ] CLI/Slack 특화 provider는 CLI에 유지

### 3.3 Knowledge 모듈 이동
- [x] `src/knowledge/DocumentManager.ts` → `packages/sdk/src/knowledge/`
- [ ] `src/services/document-loader.service.ts` → `packages/sdk/src/knowledge/`

## Phase 4: AI 서비스 분리 및 아키텍처 정비 (✅ 완료)

> 📄 상세 보고서: [wbs-2-phase4-summary.md](wbs-2-phase4-summary.md)

### 4.1 AI 서비스 의존성 분석
- [x] `ai.service.ts` ConfigService 의존성 분석 완료
- [x] `ai-provider.service.ts` ConfigService 의존성 분석 완료
- [x] 아키텍처 분리 전략 결정 및 문서화

**핵심 결론**:
- ✅ **현재 아키텍처가 이미 올바른 분리를 달성했음을 확인**
- ✅ AI 서비스 구현체는 CLI에 유지하는 것이 맞는 설계
- ✅ SDK는 인터페이스만 제공하여 느슨한 결합 유지
- ✅ ConfigService 의존성은 CLI 레이어에서만 필요하며 불필요한 분리 작업 없음

**분석 결과 및 결정사항:**

#### AI Service 구조 (✅ 현재 상태 유지)
```
SDK (재사용 가능한 빌딩 블록):
└── AIProvider Interface (ai-provider.interface.ts)
    ├── query(prompt, options): Promise<AIResponse>
    ├── execute(prompt, options): Promise<AIResponse>
    └── isAvailable(): Promise<boolean>

CLI (애플리케이션 레이어):
├── AIProviderService (오케스트레이션)
│   └── ConfigService 의존 (YAML config → dynamic providers)
├── AIService (실행 레이어)
│   └── CLI 도구 직접 호출 (spawn, exec)
├── BaseAIProvider (기본 구현 + 공통 로직)
├── Provider 구현체 (Claude, Gemini, Copilot, Codex)
├── DynamicProviderFactory (plugin/remote 생성)
└── ConfigService (YAML 설정 관리)
```

#### ConfigService 의존성이 필수적인 이유:
1. **YAML 기반 동적 Provider 로딩**: `getDynamicProviders()`, `getPluginProviders()`, `getRemoteProviders()`
2. **Agent 설정 관리**: `crewx.yaml` / `agents.yaml` 파싱 및 검증
3. **CLI 전용 기능**: SDK 사용자는 프로그래매틱하게 Provider를 직접 생성 가능

#### SDK vs CLI 분리가 올바른 이유:
- ✅ SDK는 ConfigService 없이 독립적으로 사용 가능
- ✅ SDK 사용자는 Provider를 직접 인스턴스화: `new ClaudeProvider()` (향후)
- ✅ CLI는 YAML 기반 설정으로 사용자 편의성 제공
- ✅ 순환 의존성 없음 (SDK → CLI 의존 없음, 단방향 의존성)

### 4.2 서비스 분리 전략 확정

**CLI에 유지 (✅ 최종 결정):**
- `ai.service.ts` - CLI 도구 실행 로직 (spawn/exec)
- `ai-provider.service.ts` - ConfigService 의존적 오케스트레이션
- `config.service.ts` - YAML 설정 관리
- `agent-loader.service.ts` - ConfigService 의존
- `tool-call.service.ts` - MCP 구현체 (CLI 전용)
- **Provider 구현체 (모두 CLI 유지)**:
  - `base-ai.provider.ts` (863줄) - 공통 로직, 파일 시스템 접근
  - `claude.provider.ts` - Claude CLI 실행
  - `gemini.provider.ts` - Gemini CLI 실행
  - `copilot.provider.ts` - Copilot CLI 실행
  - `codex.provider.ts` - Codex CLI 실행
  - `dynamic-provider.factory.ts` - 동적 생성 (ConfigService 의존)

**향후 SDK 이동 검토 대상 (Phase 5+):**
- `template.service.ts` - 템플릿 엔진 (독립적)
- `parallel-processing.service.ts` - 병렬 처리 유틸 (독립적)
- `intelligent-compression.service.ts` - 대화 압축 (독립적)
- `context-enhancement.service.ts` - 컨텍스트 향상 (독립적)

### 4.3 아키텍처 검증
- [x] SDK 빌드 성공 확인 (`npm run build -w @sowonai/crewx-sdk`) ✅
- [x] CLI 빌드 성공 확인 (`npm run build`) ✅
- [x] 순환 의존성 없음 확인 ✅
- [x] SDK 공개 API 독립성 확인 (`packages/sdk/src/index.ts`) ✅
- [x] Import 경로 검증 (`@sowonai/crewx-sdk` workspace 의존성) ✅

### 4.4 문서화
- [x] 아키텍처 분석 보고서 작성 (`wbs-2-phase4-summary.md`) ✅
- [x] 주요 변경사항 기록 ✅
- [x] 서비스 분리 전략 결정 문서화 ✅

## Phase 5: SDK 공개 API 정리 (✅ 완료)

### 5.1 Public API 설계
- [x] `src/index.ts`에서 공개 API를 명시적으로 export (타입/상수/계약 위주)
- [x] CLI 의존 클래스(`ConversationStorageService`)는 `@sowonai/crewx-sdk/internal` 서브패스로 이동
- [x] MentionParser 등 SDK 유틸은 명시적으로 유지하며 불필요한 와일드카드 export 제거

### 5.2 패키지 배포 설정
- [x] `package.json` `exports`에 `./internal` 및 `./package.json` 선언
- [x] 패키지 `files` 목록에 `LICENSE` 추가
- [x] Apache-2.0 전문을 `packages/sdk/LICENSE`로 추가

### 5.3 문서/워크플로우 연동
- [x] `wbs.md`에 Phase 5 완료 상황 기록
- [x] thread/요약용 메모 준비 (공개 API 목록 및 라이선스 처리)
- [x] 후속 Phase(테스트/빌드) 참고용 메모 반영

## 체크포인트 및 검증

### 일일 검증 항목
- [ ] Day 1: 기본 유틸리티 import 테스트
- [ ] Day 2: Provider 인터페이스 호환성
- [ ] Day 3: Conversation 모듈 독립성
- [ ] Day 4: 서비스 간 의존성 해결
- [ ] Day 5: 전체 통합 테스트

### 리스크 관리
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| NestJS 순환 의존성 | 높음 | 이벤트 기반 통신 도입 |
| 대형 파일 분리 실패 | 높음 | 단계적 인터페이스 추출 |
| 타입 호환성 깨짐 | 중간 | 타입 테스트 추가 |
| 테스트 커버리지 감소 | 중간 | 테스트 우선 이동 |

## 성공 지표
- [ ] SDK 독립 빌드 성공
- [ ] 모든 타입 정의 export
- [ ] 단위 테스트 통과율 80% 이상
- [ ] 0 순환 의존성
- [ ] npm publish 가능 상태

## 산출물
- `packages/sdk/dist/` - 빌드된 SDK
- `packages/sdk/dist/index.d.ts` - 타입 정의
- API 문서
- 마이그레이션 가이드

## 다음 단계
- WBS-3과 통합 테스트
- WBS-4로 전체 테스트 재구성
