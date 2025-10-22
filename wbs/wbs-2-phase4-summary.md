[← WBS 개요](../wbs.md)

# WBS-2 Phase 4: AI 서비스 아키텍처 분석 및 분리 전략 완료 보고서

**작성일**: 2025-10-16
**작성자**: @crewx_claude_dev
**브랜치**: feature/monorepo
**상태**: ✅ 완료

---

## 📋 Executive Summary

WBS-2 Phase 4는 AI 서비스 레이어(`ai.service.ts`, `ai-provider.service.ts`)와 ConfigService 간의 의존성을 분석하고, SDK/CLI 간 올바른 아키텍처 분리 전략을 확정하는 작업이었습니다.

**핵심 결론**:
- ✅ **현재 아키텍처가 이미 올바른 분리를 달성했음을 확인**
- ✅ AI 서비스 구현체는 CLI에 유지하는 것이 맞는 설계
- ✅ SDK는 인터페이스만 제공하여 느슨한 결합 유지
- ✅ ConfigService 의존성은 CLI 레이어에서만 필요하며 불필요한 분리 작업 없음

---

## 🔍 분석 내용

### 1. ConfigService 의존성 분석

#### 1.1 `AIProviderService` (ai-provider.service.ts:226줄)

**ConfigService 의존 위치**:
```typescript
@Injectable()
export class AIProviderService implements OnModuleInit {
  constructor(
    private readonly claudeProvider: ClaudeProvider,
    private readonly copilotProvider: CopilotProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly codexProvider: CodexProvider,
    private readonly dynamicProviderFactory: DynamicProviderFactory,
    private readonly configService: ConfigService,  // ← ConfigService 의존
  ) {}
}
```

**사용 목적**:
1. **동적 Provider 로딩** (라인 42-72):
   ```typescript
   private async loadPluginProviders(): Promise<void> {
     const dynamicConfigs = this.configService.getDynamicProviders();
     // YAML에서 plugin/remote provider 설정 읽어서 동적 생성
   }
   ```

2. **Plugin Provider 설정 조회** (라인 218-224):
   ```typescript
   getPluginProviders(): any[] {
     return this.configService.getPluginProviders();
   }
   getRemoteProviders(): RemoteProviderConfig[] {
     return this.configService.getRemoteProviders();
   }
   ```

**의존성 이유**:
- `crewx.yaml` / `agents.yaml`에서 동적으로 정의된 provider 설정을 읽어 런타임에 생성
- CLI 사용자 경험을 위한 설정 기반 자동화 (예: `plugin/mock`, `remote/api-server`)
- SDK 사용자는 이런 YAML 기반 로딩이 필요 없음 (Provider를 직접 인스턴스화)

#### 1.2 `AIService` (ai.service.ts:728줄)

**ConfigService 의존 없음**:
```typescript
@Injectable()
export class AIService {
  constructor(private readonly aiProviderService: AIProviderService) {}
  // ConfigService 직접 의존 없음, AIProviderService를 통해 간접 사용
}
```

**역할**:
- CLI 도구 직접 실행 (`spawn`, `exec`)
- 레거시 메서드 제공 (`queryClaudeCLI`, `queryGeminiCLI`, `queryCopilotCLI`)
- 최종적으로 `aiProviderService.queryAI()` / `aiProviderService.executeAI()` 위임

---

### 2. 아키텍처 레이어 분리 현황

#### 현재 구조 (✅ 올바른 분리 달성):

```
┌─────────────────────────────────────────────────────────────┐
│ CLI Package (packages/cli)                                  │
│ - Application Layer                                          │
│ - YAML 기반 설정 관리                                         │
│ - CLI 도구 실행 (spawn/exec)                                 │
├─────────────────────────────────────────────────────────────┤
│ AIService (ai.service.ts)                                   │
│  └─> AIProviderService (ai-provider.service.ts)             │
│       └─> ConfigService (YAML 파싱)                         │
│       └─> DynamicProviderFactory                             │
│            └─> Plugin/Remote Provider 동적 생성              │
│                                                              │
│ Provider 구현체 (CLI에서 관리):                               │
│  - BaseAIProvider (base-ai.provider.ts)                     │
│  - ClaudeProvider (claude.provider.ts)                      │
│  - GeminiProvider (gemini.provider.ts)                      │
│  - CopilotProvider (copilot.provider.ts)                    │
│  - CodexProvider (codex.provider.ts)                        │
│  - DynamicProviderFactory (plugin/remote 생성)              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ implements
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SDK Package (@sowonai/crewx-sdk)                                    │
│ - Pure Business Logic Layer                                 │
│ - Interface Definitions Only                                │
├─────────────────────────────────────────────────────────────┤
│ AIProvider Interface (ai-provider.interface.ts)             │
│  - query(prompt, options): Promise<AIResponse>              │
│  - execute(prompt, options): Promise<AIResponse>            │
│  - isAvailable(): Promise<boolean>                          │
│                                                              │
│ Types:                                                       │
│  - AIQueryOptions                                            │
│  - AIResponse                                                │
│  - ProviderNotAvailableError                                │
└─────────────────────────────────────────────────────────────┘
```

#### 분리 원칙 준수:

| 항목 | SDK | CLI | 이유 |
|------|-----|-----|------|
| AIProvider 인터페이스 | ✅ | - | 확장 가능한 계약 정의 |
| Provider 구현체 | - | ✅ | CLI 도구 의존 (spawn/exec) |
| AIProviderService | - | ✅ | ConfigService 의존 |
| AIService | - | ✅ | CLI 도구 실행 로직 |
| ConfigService | - | ✅ | YAML 파싱 (CLI 전용) |
| DynamicProviderFactory | - | ✅ | 설정 기반 생성 (CLI 전용) |

---

### 3. ConfigService 의존성을 최소화할 수 있는가?

**결론: 불필요하며 부적절함**

**이유**:
1. **SDK는 ConfigService 없이 독립적으로 사용 가능**:
   ```typescript
   // SDK 사용자는 Provider를 직접 생성
   import { ClaudeProvider } from 'crewx-cli-internals'; // (가정)
   const provider = new ClaudeProvider();
   await provider.query("Hello AI");
   ```

2. **CLI는 YAML 기반 편의성 제공**:
   ```yaml
   # crewx.yaml
   providers:
     - id: custom-claude
       type: plugin
       command: claude
       args: ["--model=opus"]
   ```
   - ConfigService가 없으면 사용자가 매번 Provider를 코드로 생성해야 함
   - CLI 도구의 핵심 가치인 **설정 기반 간편성** 상실

3. **순환 의존성 없음**:
   - SDK → CLI 의존 없음 (SDK는 인터페이스만 제공)
   - CLI → SDK 의존 (인터페이스 구현)
   - **단방향 의존성**으로 건강한 아키텍처 유지

---

### 4. SDK/CLI 분리 전략 확정

#### 4.1 SDK에 포함 (✅ 이미 완료):
- ✅ `AIProvider` 인터페이스 (`packages/sdk/src/core/providers/ai-provider.interface.ts`)
- ✅ `AIQueryOptions`, `AIResponse` 타입
- ✅ `ProviderNotAvailableError` 에러 클래스
- ✅ 타입 정의 (`agent.types.ts`, `constants`, `utils`)
- ✅ 대화 인터페이스 (`conversation-history.interface.ts`)
- ✅ 지식 관리 (`DocumentManager.ts`)

#### 4.2 CLI에 유지 (✅ 현재 상태 유지):
- ✅ `AIService` (ai.service.ts) - CLI 도구 실행
- ✅ `AIProviderService` (ai-provider.service.ts) - 오케스트레이션
- ✅ Provider 구현체:
  - `BaseAIProvider` (base-ai.provider.ts:863줄) - 공통 로직
  - `ClaudeProvider` (claude.provider.ts)
  - `GeminiProvider` (gemini.provider.ts)
  - `CopilotProvider` (copilot.provider.ts)
  - `CodexProvider` (codex.provider.ts)
- ✅ `DynamicProviderFactory` (dynamic-provider.factory.ts) - 동적 생성
- ✅ `ConfigService` (config.service.ts) - YAML 설정

#### 4.3 향후 이동 검토 대상 (Phase 5 이후):
- `TemplateService` - 독립적 템플릿 엔진 (ConfigService 의존 없음)
- `ParallelProcessingService` - 병렬 처리 유틸 (독립적)
- `IntelligentCompressionService` - 대화 압축 (독립적)
- `ContextEnhancementService` - 컨텍스트 향상 (독립적)

---

## ✅ 검증 결과

### 빌드 검증:
```bash
# SDK 독립 빌드 성공
$ npm run build -w @sowonai/crewx-sdk
> @sowonai/crewx-sdk@0.1.0 build
> tsc -p tsconfig.json
✅ SUCCESS

# 전체 빌드 성공
$ npm run build
> crewx@0.3.0 build
> nest build -c ../../nest-cli.json
✅ Shebang already present
✅ Execute permission set (/Users/doha/git/crewx/dist/main.js)

> @sowonai/crewx-sdk@0.1.0 build
> tsc -p tsconfig.json
✅ SUCCESS
```

### 아키텍처 검증:
- ✅ SDK는 ConfigService 없이 독립적으로 빌드 가능
- ✅ CLI는 SDK를 workspace 의존성으로 사용
- ✅ 순환 의존성 없음 (SDK → CLI 의존 없음)
- ✅ 타입 정의 정상 export (`packages/sdk/src/index.ts`)

### Import 경로 검증:
```typescript
// CLI에서 SDK import (정상 작동)
import { AIProvider, AIQueryOptions, AIResponse, getTimeoutConfig } from '@sowonai/crewx-sdk';
```

---

## 📊 주요 결정사항

### 1. AI Service 아키텍처는 현재 상태 유지
**이유**:
- SDK는 인터페이스만 제공하여 확장 가능성 제공
- CLI는 ConfigService 기반 동적 로딩으로 사용자 편의성 제공
- 순환 의존성 없이 깔끔한 단방향 의존성 유지
- 불필요한 리팩토링으로 인한 버그 리스크 방지

### 2. ConfigService 의존성 분리 불필요
**이유**:
- SDK 사용자는 Provider를 직접 생성 (ConfigService 불필요)
- CLI 사용자는 YAML 설정 기반 자동화 필요 (ConfigService 필수)
- 분리 시 CLI의 핵심 가치인 "설정 기반 편의성" 상실
- 아키텍처적으로 이미 적절히 분리되어 있음

### 3. Provider 구현체는 CLI에 유지
**이유**:
- `spawn`, `exec` 등 Node.js 프로세스 API 직접 사용
- 파일 시스템 접근 (로그 파일 생성, 태스크 로그)
- CLI 도구 경로 탐색 (`which`, `where` 명령)
- Tool Call 서비스 통합 (MCP 프로토콜 구현)

---

## 📈 아키텍처 이점

### SDK 측면:
1. **느슨한 결합**: 인터페이스만 제공하여 구현체 독립성 보장
2. **확장 가능성**: 외부 팀이 자체 Provider 구현 가능
3. **경량성**: ConfigService, 파일 시스템 의존성 없음
4. **타입 안전성**: TypeScript 인터페이스로 계약 명확화

### CLI 측면:
1. **사용자 편의성**: YAML 설정 기반 자동 Provider 로딩
2. **동적 확장**: Plugin/Remote Provider 런타임 추가
3. **모니터링**: 태스크 로그, 실행 추적 기능
4. **통합성**: Slack, MCP 등 플랫폼 통합 용이

---

## 🎯 다음 단계 (WBS-2 Phase 5)

### Phase 5: SDK 공개 API 정리
1. **Factory 함수 구현**:
   ```typescript
   // packages/sdk/src/index.ts
   export { createCrewxAgent } from './factory';
   export type { CrewxAgentConfig } from './types';
   ```

2. **TypeDoc API 문서 생성**:
   - 자동화된 API 레퍼런스
   - 사용 예제 코드
   - README.md 작성

3. **사용 예제 작성**:
   ```typescript
   import { createCrewxAgent } from '@sowonai/crewx-sdk';

   const agent = await createCrewxAgent({
     providers: {
       'custom/my-ai': new MyCustomProvider(),
     },
   });

   const result = await agent.query('Hello AI');
   ```

---

## 📝 요약

**WBS-2 Phase 4 완료 상태**:
- ✅ AI 서비스 ConfigService 의존성 분석 완료
- ✅ 의존성 최소화 필요성 검토 완료 (불필요함 확인)
- ✅ SDK/CLI 분리 전략 확정 (현재 아키텍처 유지)
- ✅ Import 경로 및 빌드 검증 완료
- ✅ 아키텍처 문서화 완료

**핵심 결론**:
> **현재 아키텍처는 이미 SDK/CLI 간 올바른 분리를 달성했으며, AI 서비스 구현체를 CLI에 유지하는 것이 적절한 설계입니다. ConfigService 의존성은 CLI의 핵심 가치인 "YAML 기반 설정 자동화"를 위해 필수이며, SDK는 인터페이스만 제공하여 느슨한 결합을 유지합니다.**

---

**작성자**: @crewx_claude_dev
**검토**: Phase 1-3 완료 상황 기반
**다음 단계**: WBS-2 Phase 5 - SDK 공개 API 정리
