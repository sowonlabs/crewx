# CrewX WBS - API Provider Implementation

> 상태 표시: `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⚠️ 위험`, `❌ 실패`

## 프로젝트 개요

**목표**: Vercel AI SDK 기반 API Provider 구현으로 LiteLLM 게이트웨이 지원 및 Tool Calling 통합

**배경**:
- 기존: CLI Provider만 존재 (spawn 기반, 로컬 코딩 에이전트 전용)
- 신규: API Provider 추가 (HTTP + Tool Calling, 서버 환경 지원)
- YAML 스펙: SowonFlow 스펙 참고하여 확장 가능하게 설계

**기술 스택**:
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`)
- Zod (스키마 검증)
- SowonFlow YAML 스펙 (mcp_servers, tools 정의)

---

## 현황

| 상태  | ID         | 작업명                  | 주요 산출물 및 범위                              | 선행 디펜던시 | 예상 소요  | 우선순위   |
| --- | ---------- | -------------------- | ---------------------------------------- | ------- | ------ | ------ |
| ✅   | WBS-19     | API Provider 설계 및 기획 | 아키텍처 설계, YAML 스펙 정의, **Mastra 통합 전략**    | -       | 2-3일   | P0     |
| ⬜️  | WBS-20     | **Mastra 통합**        | MastraAPIProvider, Tool 어댑터, 7 Providers | WBS-19  | **3일** | P0     |
| ✅   | ~~WBS-21~~ | ~~Tool Calling 시스템~~ | ~~Mastra 제공~~                            | ~~생략~~  | ~~0일~~ | ~~P0~~ |
| ✅   | ~~WBS-22~~ | ~~MCP 통합~~           | ~~Mastra MCP 활용~~                        | ~~생략~~  | ~~0일~~ | ~~P1~~ |
| ⬜️  | WBS-23     | YAML 파싱 및 Agent 생성   | Dynamic Provider Factory, YAML 로더        | WBS-20  | 2-3일   | P0     |
| ⬜️  | WBS-24     | CLI 통합               | CLI 명령어 API provider 지원                  | WBS-23  | 1-2일   | P0     |
| ⬜️  | WBS-25     | 문서화 및 예제             | 사용 가이드, 예제 코드, 마이그레이션 가이드                | WBS-24  | 2-3일   | P1     |

**총 예상 소요**: ~~3-4주~~ → **1.5-2주** (Mastra 통합으로 50% 단축)

### 🎯 Mastra 통합 결정 (2025-11-11)
- **배경**: SowonFlow v1 (LangGraph) → v2 (Mastra) → CrewX
- **전략**: BaseAPIProvider 직접 구현 ❌ → Mastra 래핑 ✅
- **절감**: WBS-21, WBS-22 생략 (Mastra가 제공) → **7-9일 절약**

---

## 상세 작업 계획

### WBS-19 API Provider 설계 및 기획 (✅ 완료)
> 📄 상세 계획: [wbs/wbs-19-api-provider-design.md](wbs/wbs-19-api-provider-design.md)

**목표**: API Provider 아키텍처 설계 및 YAML 스펙 정의

- **Phase 1**: 아키텍처 설계 (1일) ✅ **완료**
  - ✅ Provider 계층 구조 설계 (`BaseAPIProvider`, `VercelAIProvider`)
  - ✅ 기존 `BaseAIProvider`와의 관계 정리
  - ✅ Tool Calling 흐름 설계
  - ✅ MCP 통합 포인트 설계
  - 📄 산출물: [wbs/wbs-19-architecture-diagram.md](wbs/wbs-19-architecture-diagram.md)

- **Phase 2**: YAML 스펙 정의 (1일) ✅ **완료**
  - ✅ SowonFlow YAML 스펙 분석 및 CrewX 적용
  - ✅ `agents[].inline` 스키마 확장 (provider: "api", model, base_url, etc.)
  - ✅ `mcp_servers` 섹션 정의
  - ✅ `tools` 섹션 정의 (Simple Array 패턴)
  - ✅ JSON Schema 생성
  - 📄 산출물: [wbs/wbs-19-sowonflow-spec-analysis.md](wbs/wbs-19-sowonflow-spec-analysis.md)

- **Phase 3**: 타입 시스템 설계 (0.5일) ✅ **완료**
  - ✅ TypeScript 인터페이스 정의 (`APIProviderConfig`, `ToolDefinition`, `MCPServerConfig`)
  - ✅ Zod 스키마 정의
  - ✅ SowonFlow 타입과의 호환성 검증
  - 📄 산출물:
    - [packages/sdk/src/types/api-provider.types.ts](packages/sdk/src/types/api-provider.types.ts)
    - [packages/sdk/src/schemas/api-provider.schema.ts](packages/sdk/src/schemas/api-provider.schema.ts)
    - [packages/sdk/schema/api-provider-config.json](packages/sdk/schema/api-provider-config.json)

- **Phase 4**: 설계 검토 및 문서화 (0.5일) ✅ **완료**
  - ✅ @crewx_claude_dev 코드 리뷰 (3차)
  - ✅ @sowonflow_claude_dev SowonFlow 스펙 검증
  - ✅ 설계 문서 작성
  - ✅ YAML 환경 변수 표기법 통일 (`{{env.VAR}}`)
  - 📄 산출물: [wbs/wbs-19-design-document.md](wbs/wbs-19-design-document.md)
  - 📄 **회의록**: [wbs/wbs-19-design-review-meeting-minutes.md](wbs/wbs-19-design-review-meeting-minutes.md)
  - 📄 **최종 상태**: [wbs/wbs-19-final-status.md](wbs/wbs-19-final-status.md)

**산출물**:
- ✅ [wbs/wbs-19-architecture-diagram.md](wbs/wbs-19-architecture-diagram.md) - 아키텍처 다이어그램
- ✅ [wbs/wbs-19-sowonflow-spec-analysis.md](wbs/wbs-19-sowonflow-spec-analysis.md) - SowonFlow 분석
- ✅ [packages/sdk/src/types/api-provider.types.ts](packages/sdk/src/types/api-provider.types.ts) - TypeScript 타입
- ✅ [packages/sdk/src/schemas/api-provider.schema.ts](packages/sdk/src/schemas/api-provider.schema.ts) - Zod 스키마
- ✅ [packages/sdk/schema/api-provider-config.json](packages/sdk/schema/api-provider-config.json) - JSON Schema
- ✅ [wbs/wbs-19-design-document.md](wbs/wbs-19-design-document.md) - 최종 설계 문서 (의사결정 포인트 정리)

**완료 조건**:
- [x] 아키텍처 다이어그램 승인
- [x] YAML 스펙 정의 완료
- [x] 타입 시스템 컴파일 성공
- [x] 설계 문서 작성 완료
- [x] 의사결정 완료 (Function Injection, Simple Array, 7 Providers, url 필드)
- [x] 3차 에이전트 리뷰 완료 (🟢 GREEN)
- [x] YAML 표기법 통일 완료

---

### WBS-20 Mastra 통합 구현 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-20-mastra-integration.md](wbs/wbs-20-mastra-integration.md)

**목표**: Mastra 프레임워크를 래핑하여 CrewX API Provider 구현

**디펜던시**: WBS-19 (설계 완료 필요)

**배경**:
- SowonFlow v1 (LangGraph) → ❌ 복잡성 문제
- SowonFlow v2 (Mastra) → ✅ clientTool 매커니즘 발견
- CrewX 탄생 → SowonFlow + CLI/Slack

**전략**: 직접 구현 ❌ → Mastra 래핑 ✅ (65% 시간 절감)

- **Phase 1**: 의존성 추가 (0.5일)
  - ⬜️ Mastra 패키지 설치 (`@mastra/core`, `ai`, `zod`)
  - ⬜️ package.json 업데이트
  - ⬜️ TypeScript 컴파일 확인

- **Phase 2**: MastraAPIProvider 구현 (1일)
  - ⬜️ `MastraAPIProvider` 클래스 생성
  - ⬜️ 7가지 Provider 모델 생성 로직 (OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI)
  - ⬜️ `query()` / `execute()` 메서드 구현
  - ⬜️ Mastra 응답 → CrewX AIResponse 변환
  - 파일: `packages/sdk/src/core/providers/MastraAPIProvider.ts`

- **Phase 3**: Tool 어댑터 (0.5일)
  - ⬜️ `MastraToolAdapter` 구현
  - ⬜️ CrewX FrameworkToolDefinition → Mastra tool 변환
  - ⬜️ ToolExecutionContext 주입 로직
  - 파일: `packages/sdk/src/adapters/MastraToolAdapter.ts`

- **Phase 4**: Agent Factory 수정 (0.5일)
  - ⬜️ `api/` prefix 감지 → MastraAPIProvider 생성
  - ⬜️ CLI Provider와 공존 로직
  - 파일: `packages/sdk/src/agent/AgentFactory.ts`

- **Phase 5**: 통합 테스트 (0.5일)
  - ⬜️ 7가지 Provider 모두 테스트
  - ⬜️ Tool calling 테스트
  - ⬜️ CLI/Slack 인터페이스 검증
  - 파일: `packages/sdk/tests/integration/providers.test.ts`

**산출물**:
- `packages/sdk/src/core/providers/MastraAPIProvider.ts` - Mastra 래핑 (200+ lines)
- `packages/sdk/src/adapters/MastraToolAdapter.ts` - Tool 어댑터 (100+ lines)
- `packages/sdk/tests/integration/providers.test.ts` - 7 Provider 테스트

**완료 조건**:
- [ ] Mastra 의존성 설치 완료
- [ ] MastraAPIProvider 구현 완료
- [ ] 7가지 Provider 모두 작동 확인
- [ ] Tool calling 테스트 통과
- [ ] TypeScript 컴파일 성공
- [ ] CLI/Slack 인터페이스 검증

**장점**:
- ✅ Tool calling 내장 (구현 불필요)
- ✅ Streaming 내장 (구현 불필요)
- ✅ 40+ Provider 지원
- ✅ Gatsby 팀 개발 (검증됨)
- ✅ clientTool 지원 (프론트엔드 통합)

---

### ~~WBS-21 Tool Calling 시스템 구현~~ (✅ 생략)

**상태**: ✅ **생략** (Mastra가 Tool calling 내장 제공)

**이유**: MastraAPIProvider가 Mastra Agent를 사용하므로 tool calling이 이미 구현되어 있음

---

### ~~WBS-22 MCP 통합~~ (✅ 생략)

**상태**: ✅ **생략** (Mastra가 MCP 통합 제공)

**이유**: Mastra는 MCP 서버 연결 및 tool 변환을 지원하므로 직접 구현 불필요

---

### WBS-23 YAML 파싱 및 Agent 생성 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-23-yaml-parsing-agent-factory.md](wbs/wbs-23-yaml-parsing-agent-factory.md)

**목표**: crewx.yaml에서 API provider 설정 파싱 및 Agent 생성

**디펜던시**: WBS-20 (BaseAPIProvider 필요)

- **Phase 1**: YAML 스키마 확장 (0.5일)
  - ⬜️ `agents[].inline` 스키마 확장 (provider: "api" 추가)
  - ⬜️ `mcp_servers` 섹션 추가
  - ⬜️ `tools` 섹션 추가
  - ⬜️ JSON Schema 업데이트
  - 파일: `packages/sdk/schema/crewx-config.json`

- **Phase 2**: Config 파서 확장 (1일)
  - ⬜️ `parseAPIProviderConfig()` 함수 구현
  - ⬜️ YAML → `APIProviderConfig` 변환
  - ⬜️ 환경 변수 치환 (`${VAR}` 형식)
  - ⬜️ Validation (필수 필드 체크)
  - 파일: `packages/sdk/src/config/api-provider-parser.ts`

- **Phase 3**: Dynamic Provider Factory 확장 (1일)
  - ⬜️ `DynamicProviderFactory`에 API provider 지원 추가
  - ⬜️ `createAPIProvider()` 메서드 구현
  - ⬜️ Provider type 분기 (cli vs api)
  - ⬜️ BaseAPIProvider 인스턴스 생성
  - 파일: `packages/sdk/src/core/providers/dynamic-provider.factory.ts`

- **Phase 4**: Agent Factory 통합 (0.5일)
  - ⬜️ `AgentFactory`에서 API provider 지원
  - ⬜️ API provider + AgentRuntime 통합
  - ⬜️ WBS-18 Provider 주입 구조 활용

- **Phase 5**: 파싱 및 생성 테스트 (0.5일)
  - ⬜️ YAML 파싱 테스트 (valid/invalid cases)
  - ⬜️ 환경 변수 치환 테스트
  - ⬜️ Provider factory 테스트
  - ⬜️ Agent 생성 end-to-end 테스트
  - 파일: `packages/sdk/tests/unit/api-provider-parser.spec.ts`
  - 파일: `packages/sdk/tests/integration/api-agent-factory.spec.ts`

**산출물**:
- `packages/sdk/schema/crewx-config.json` - 확장된 JSON Schema
- `packages/sdk/src/config/api-provider-parser.ts` - Parser (200+ lines)
- `packages/sdk/tests/unit/api-provider-parser.spec.ts` - 단위 테스트 (12+ tests)
- `packages/sdk/tests/integration/api-agent-factory.spec.ts` - 통합 테스트 (8+ tests)

**완료 조건**:
- [ ] YAML 스키마 확장 완료
- [ ] Config 파서 구현 완료
- [ ] Dynamic Provider Factory 확장 완료
- [ ] 20개 이상 테스트 통과

---

### WBS-24 CLI 통합 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-24-cli-integration.md](wbs/wbs-24-cli-integration.md)

**목표**: CLI 명령어에서 API provider 사용 가능하도록 통합

**디펜던시**: WBS-23 (YAML 파싱 필요)

- **Phase 1**: CLI Config 로더 업데이트 (0.5일)
  - ⬜️ `ConfigService`에서 API provider config 로딩
  - ⬜️ CLI가 SDK parser 사용하도록 연결
  - ⬜️ 환경 변수 로딩 (.env 파일)
  - 파일: `packages/cli/src/config/config.service.ts`

- **Phase 2**: Agent Loader 업데이트 (0.5일)
  - ⬜️ `AgentLoaderService`에서 API provider 지원
  - ⬜️ CLI/API provider 분기 로직
  - ⬜️ Provider 인스턴스 생성 및 주입
  - 파일: `packages/cli/src/services/agent-loader.service.ts`

- **Phase 3**: CLI 명령어 지원 (0.5일)
  - ⬜️ `crewx q` 명령어에서 API agent 지원
  - ⬜️ `crewx execute` 명령어에서 API agent 지원
  - ⬜️ `crewx chat` 명령어에서 API agent 지원
  - ⬜️ `--provider` 플래그 추가 (선택적)

- **Phase 4**: Doctor 명령어 업데이트 (0.5일)
  - ⬜️ `crewx doctor` API provider 헬스 체크 추가
  - ⬜️ LiteLLM 게이트웨이 연결 확인
  - ⬜️ API key 유효성 체크
  - 파일: `packages/cli/src/handlers/doctor.handler.ts`

- **Phase 5**: CLI 통합 테스트 (0.5일)
  - ⬜️ API agent 로딩 테스트
  - ⬜️ Query/Execute 명령어 테스트
  - ⬜️ 회귀 테스트 (기존 CLI provider 정상 작동 확인)
  - 파일: `packages/cli/tests/integration/api-provider-cli.spec.ts`

**산출물**:
- `packages/cli/src/services/agent-loader.service.ts` - 업데이트
- `packages/cli/src/handlers/doctor.handler.ts` - 업데이트
- `packages/cli/tests/integration/api-provider-cli.spec.ts` - 통합 테스트 (10+ tests)

**완료 조건**:
- [ ] CLI 명령어 모두 API provider 지원
- [ ] Doctor 명령어 API provider 체크 완료
- [ ] 10개 이상 CLI 통합 테스트 통과
- [ ] 회귀 테스트 통과 (기존 기능 정상)

---

### WBS-25 고급 기능 (Streaming, Cost Tracking) (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-25-advanced-features.md](wbs/wbs-25-advanced-features.md)

**목표**: Streaming, Cost tracking 등 고급 기능 구현

**디펜던시**: WBS-24 (CLI 통합 완료)

**우선순위**: P2 (Nice-to-have)

- **Phase 1**: Streaming 지원 (1.5일)
  - ⬜️ `streamText()` 메서드 추가
  - ⬜️ `queryStream()` 메서드 구현
  - ⬜️ CLI에서 streaming 출력 지원
  - ⬜️ `--stream` 플래그 추가
  - 파일: `packages/sdk/src/core/providers/base-api.provider.ts`

- **Phase 2**: Cost Tracking (1일)
  - ⬜️ 토큰 사용량 추적 (prompt + completion)
  - ⬜️ Cost 계산 로직 (model별 가격)
  - ⬜️ Usage 메타데이터 응답에 포함
  - ⬜️ `crewx usage` 명령어 추가 (선택적)

- **Phase 3**: 고급 에러 핸들링 (0.5일)
  - ⬜️ Retry 로직 (exponential backoff)
  - ⬜️ Timeout 세밀 제어
  - ⬜️ Rate limit 핸들링
  - ⬜️ Graceful degradation

**산출물**:
- `packages/sdk/src/core/providers/base-api.provider.ts` - Streaming 추가
- `packages/cli/src/handlers/usage.handler.ts` - Usage 명령어 (선택적)

**완료 조건**:
- [ ] Streaming 구현 및 테스트 완료
- [ ] Cost tracking 구현 완료
- [ ] 에러 핸들링 강화 완료

---

### WBS-26 문서화 및 예제 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-26-documentation-examples.md](wbs/wbs-26-documentation-examples.md)

**목표**: 사용 가이드, 예제, 마이그레이션 문서 작성

**디펜던시**: WBS-24 (CLI 통합 완료)

**우선순위**: P1

- **Phase 1**: API Reference 문서 (1일)
  - ⬜️ `BaseAPIProvider` API 문서
  - ⬜️ `APIProviderConfig` 타입 문서
  - ⬜️ Tool Calling API 문서
  - ⬜️ MCP 통합 가이드
  - 파일: `docs/api-provider-reference.md`

- **Phase 2**: 사용 가이드 (1일)
  - ⬜️ Quick Start 가이드
  - ⬜️ LiteLLM 설정 방법
  - ⬜️ crewx.yaml 예제 (다양한 시나리오)
  - ⬜️ Tool calling 사용 예제
  - ⬜️ MCP 서버 연결 예제
  - 파일: `docs/api-provider-guide.md`

- **Phase 3**: 예제 코드 (0.5일)
  - ⬜️ 기본 API agent 예제 (`examples/api-agent-basic/`)
  - ⬜️ Tool calling 예제 (`examples/api-agent-tools/`)
  - ⬜️ MCP 통합 예제 (`examples/api-agent-mcp/`)
  - ⬜️ README 및 주석 추가

- **Phase 4**: 마이그레이션 가이드 (0.5일)
  - ⬜️ CLI provider → API provider 마이그레이션
  - ⬜️ 언제 어떤 provider를 사용할지 가이드
  - ⬜️ FAQ 섹션
  - 파일: `docs/migration-to-api-provider.md`

**산출물**:
- `docs/api-provider-reference.md` - API Reference (30+ 페이지)
- `docs/api-provider-guide.md` - 사용 가이드 (40+ 페이지)
- `docs/migration-to-api-provider.md` - 마이그레이션 가이드
- `examples/api-agent-basic/` - 기본 예제
- `examples/api-agent-tools/` - Tool calling 예제
- `examples/api-agent-mcp/` - MCP 예제

**완료 조건**:
- [ ] API Reference 문서 완성
- [ ] 사용 가이드 완성
- [ ] 3개 예제 코드 작성 및 검증
- [ ] 마이그레이션 가이드 완성

---

## 전체 타임라인

```
Week 1: WBS-19 (설계) + WBS-20 (BaseAPIProvider)
Week 2: WBS-21 (Tool Calling) + WBS-22 (MCP) 시작
Week 3: WBS-22 (MCP) 완료 + WBS-23 (YAML) + WBS-24 (CLI 통합)
Week 4: WBS-25 (고급 기능) + WBS-26 (문서화)
```

**Critical Path**: WBS-19 → WBS-20 → WBS-21 → WBS-23 → WBS-24

---

## 위험 관리

| 위험 | 영향도 | 완화 전략 |
|------|--------|----------|
| Vercel AI SDK 버전 호환성 | 중 | 초기 PoC로 검증, Lock 파일 사용 |
| MCP 프로토콜 복잡도 | 중 | SowonFlow 패턴 참고, 단계적 구현 |
| Tool calling loop 안정성 | 중 | maxSteps 제한, 충분한 테스트 |
| 기존 CLI provider 회귀 | 고 | 회귀 테스트 자동화, CI/CD |
| YAML 스펙 변경 영향 | 중 | 하위 호환성 유지, feature flag |

---

## 성공 기준

- [ ] BaseAPIProvider 구현 완료 및 테스트 통과 (90% 커버리지)
- [ ] 3개 local tools 구현 및 검증 완료
- [ ] MCP 통합 및 최소 2개 MCP 서버 테스트 완료
- [ ] CLI 명령어 모두 API provider 지원
- [ ] 기존 CLI provider 회귀 테스트 100% 통과
- [ ] 문서화 완료 및 3개 예제 코드 작성
- [ ] LiteLLM 게이트웨이 연동 검증 완료

---

## 참고 문서

### WBS-19 산출물 (API Provider 설계)
- [Phase 1: 아키텍처 설계](wbs/wbs-19-architecture-diagram.md) - BaseAPIProvider 구조, Tool Calling 흐름, MCP 통합
- [Phase 2: SowonFlow 스펙 분석](wbs/wbs-19-sowonflow-spec-analysis.md) - SowonFlow YAML 구조 및 패턴 분석
- [Phase 3: 타입 시스템](packages/sdk/src/types/api-provider.types.ts) - TypeScript 인터페이스 정의
- [Phase 3: Zod 스키마](packages/sdk/src/schemas/api-provider.schema.ts) - Validation 스키마
- [Phase 3: JSON Schema](packages/sdk/schema/api-provider-config.json) - VSCode 자동완성 지원

### 기타 참고 자료
- [SowonFlow 프로덕션 코드](file:///Users/doha/git/sowonai/packages/sowonflow)
- [Vercel AI SDK 문서](https://sdk.vercel.ai/docs)
- [CrewX Provider 아키텍처](packages/sdk/src/core/providers/)
- [WBS-18 Provider 통합](wbs/wbs-18-agent-provider-integration.md)
