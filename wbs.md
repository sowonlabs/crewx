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

| 상태 | ID | 작업명 | 주요 산출물 및 범위 | 선행 디펜던시 | 예상 소요 | 우선순위 |
|------|-----|--------|-------------------|-------------|----------|---------|
| 🟡 | WBS-19 | API Provider 설계 및 기획 | 아키텍처 설계, YAML 스펙 정의, 타입 시스템 | - | 2-3일 | P0 |
| ⬜️ | WBS-20 | BaseAPIProvider 핵심 구현 | Vercel AI SDK 통합, generateText 구현 | WBS-19 | 3-4일 | P0 |
| ⬜️ | WBS-21 | Tool Calling 시스템 구현 | LocalToolHandler, Tool 변환, HTTP Tools | WBS-20 | 4-5일 | P0 |
| ⬜️ | WBS-22 | MCP 통합 | MCP Client, MCP → Vercel Tools 변환 | WBS-21 | 3-4일 | P1 |
| ⬜️ | WBS-23 | YAML 파싱 및 Agent 생성 | Dynamic Provider Factory, YAML 로더 | WBS-20 | 2-3일 | P0 |
| ⬜️ | WBS-24 | CLI 통합 | CLI 명령어 API provider 지원 | WBS-23 | 2-3일 | P0 |
| ⬜️ | WBS-25 | 고급 기능 (Streaming, Cost Tracking) | streamText 구현, 토큰 추적 | WBS-24 | 3-4일 | P2 |
| ⬜️ | WBS-26 | 문서화 및 예제 | 사용 가이드, 예제 코드, 마이그레이션 가이드 | WBS-24 | 2-3일 | P1 |

**총 예상 소요**: 3-4주

---

## 상세 작업 계획

### WBS-19 API Provider 설계 및 기획 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-19-api-provider-design.md](wbs/wbs-19-api-provider-design.md)

**목표**: API Provider 아키텍처 설계 및 YAML 스펙 정의

- **Phase 1**: 아키텍처 설계 (1일)
  - ⬜️ Provider 계층 구조 설계 (`BaseAPIProvider`, `VercelAIProvider`)
  - ⬜️ 기존 `BaseAIProvider`와의 관계 정리
  - ⬜️ Tool Calling 흐름 설계
  - ⬜️ MCP 통합 포인트 설계
  - 산출물: `wbs/wbs-19-architecture-diagram.md`

- **Phase 2**: YAML 스펙 정의 (1일)
  - ⬜️ SowonFlow YAML 스펙 분석 및 CrewX 적용
  - ⬜️ `agents[].inline` 스키마 확장 (provider: "api", model, base_url, etc.)
  - ⬜️ `mcp_servers` 섹션 정의
  - ⬜️ `tools` 섹션 정의 (local, server, custom HTTP)
  - ⬜️ JSON Schema 생성
  - 산출물: `packages/sdk/schema/api-provider-config.json`

- **Phase 3**: 타입 시스템 설계 (0.5일)
  - ⬜️ TypeScript 인터페이스 정의 (`APIProviderConfig`, `ToolDefinition`, `MCPServerConfig`)
  - ⬜️ Zod 스키마 정의
  - ⬜️ SowonFlow 타입과의 호환성 검증
  - 산출물: `packages/sdk/src/types/api-provider.types.ts`

- **Phase 4**: 설계 검토 및 문서화 (0.5일)
  - ⬜️ @crewx_claude_dev 코드 리뷰
  - ⬜️ @sowonflow_claude_dev SowonFlow 스펙 검증
  - ⬜️ 설계 문서 작성
  - 산출물: `wbs/wbs-19-design-document.md`

**산출물**:
- `wbs/wbs-19-architecture-diagram.md` - 아키텍처 다이어그램 및 설명
- `wbs/wbs-19-design-document.md` - 상세 설계 문서 (40+ 페이지)
- `packages/sdk/src/types/api-provider.types.ts` - 타입 정의
- `packages/sdk/schema/api-provider-config.json` - JSON Schema

**완료 조건**:
- [ ] 아키텍처 다이어그램 승인
- [ ] YAML 스펙 정의 완료
- [ ] 타입 시스템 컴파일 성공
- [ ] 설계 문서 리뷰 완료

---

### WBS-20 BaseAPIProvider 핵심 구현 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-20-base-api-provider.md](wbs/wbs-20-base-api-provider.md)

**목표**: Vercel AI SDK 기반 BaseAPIProvider 구현

**디펜던시**: WBS-19 (설계 완료 필요)

- **Phase 1**: 기본 구조 구현 (1일)
  - ⬜️ `BaseAPIProvider` 클래스 뼈대 생성
  - ⬜️ `AIProvider` 인터페이스 구현
  - ⬜️ Model 초기화 로직 (OpenAI Compatible, Native OpenAI)
  - ⬜️ 생성자 및 초기화 메서드
  - 파일: `packages/sdk/src/core/providers/base-api.provider.ts`

- **Phase 2**: generateText 통합 (1일)
  - ⬜️ `query()` 메서드 구현 (Vercel `generateText` 사용)
  - ⬜️ `execute()` 메서드 구현 (query와 동일)
  - ⬜️ System prompt 처리
  - ⬜️ Temperature, maxTokens 파라미터 적용
  - ⬜️ 에러 핸들링 및 응답 변환

- **Phase 3**: 기본 테스트 작성 (0.5일)
  - ⬜️ Mock Provider 테스트 (tool 없이)
  - ⬜️ OpenAI Compatible 초기화 테스트
  - ⬜️ generateText 호출 테스트
  - ⬜️ 에러 핸들링 테스트
  - 파일: `packages/sdk/tests/unit/base-api-provider.spec.ts`

- **Phase 4**: isAvailable, getToolPath 구현 (0.5일)
  - ⬜️ `isAvailable()` 구현 (health check)
  - ⬜️ `getToolPath()` 구현 (null 반환, API provider는 로컬 경로 없음)
  - ⬜️ 단위 테스트 추가

- **Phase 5**: SDK exports 업데이트 및 빌드 검증 (0.5일)
  - ⬜️ `packages/sdk/src/index.ts` 업데이트
  - ⬜️ TypeScript 컴파일 검증
  - ⬜️ 빌드 스크립트 실행 (`npm run build`)
  - ⬜️ 타입 선언 파일 생성 확인

**산출물**:
- `packages/sdk/src/core/providers/base-api.provider.ts` - BaseAPIProvider 구현 (300+ lines)
- `packages/sdk/tests/unit/base-api-provider.spec.ts` - 단위 테스트 (15+ tests)
- `packages/sdk/src/index.ts` - Public API exports 업데이트

**완료 조건**:
- [ ] BaseAPIProvider 클래스 구현 완료
- [ ] 15개 이상 단위 테스트 통과
- [ ] TypeScript 컴파일 성공
- [ ] npm run build 성공

---

### WBS-21 Tool Calling 시스템 구현 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-21-tool-calling-system.md](wbs/wbs-21-tool-calling-system.md)

**목표**: Local tools, HTTP tools, Tool 변환 로직 구현

**디펜던시**: WBS-20 (BaseAPIProvider 필요)

- **Phase 1**: LocalToolHandler 구현 (1일)
  - ⬜️ `ToolCallHandler` 인터페이스 구현
  - ⬜️ `read_file` tool 구현
  - ⬜️ `write_file` tool 구현
  - ⬜️ `bash_command` tool 구현
  - ⬜️ Tool 실행 및 에러 핸들링
  - 파일: `packages/sdk/src/core/tools/local-tool-handler.ts`

- **Phase 2**: Tool 변환 로직 (1일)
  - ⬜️ `convertToolsToVercel()` 구현 (Tool → Vercel `CoreTool`)
  - ⬜️ JSON Schema → Zod schema 변환 (`convertToZodSchema()`)
  - ⬜️ Tool description, parameters 매핑
  - ⬜️ Tool execute 래퍼 구현
  - 파일: `packages/sdk/src/core/providers/base-api.provider.ts` (메서드 추가)

- **Phase 3**: generateText tool 통합 (1일)
  - ⬜️ `initializeTools()` 메서드 구현 (local tools 로딩)
  - ⬜️ generateText에 tools 전달
  - ⬜️ maxSteps 설정 (tool calling loop)
  - ⬜️ Tool execution 결과 처리
  - ⬜️ Tool calling 에러 핸들링

- **Phase 4**: HTTP Tool Handler 구현 (1일)
  - ⬜️ `executeHttpTool()` 메서드 구현
  - ⬜️ HTTP POST/GET 지원
  - ⬜️ Headers, Auth 처리
  - ⬜️ 응답 파싱 및 에러 핸들링
  - ⬜️ Custom tools YAML 로딩

- **Phase 5**: Tool Calling 테스트 (1일)
  - ⬜️ LocalToolHandler 단위 테스트 (각 tool별)
  - ⬜️ Tool 변환 로직 테스트
  - ⬜️ generateText + tools 통합 테스트
  - ⬜️ HTTP tool 테스트 (mock fetch)
  - ⬜️ Tool calling loop 테스트
  - 파일: `packages/sdk/tests/unit/local-tool-handler.spec.ts`
  - 파일: `packages/sdk/tests/integration/tool-calling.spec.ts`

**산출물**:
- `packages/sdk/src/core/tools/local-tool-handler.ts` - LocalToolHandler (200+ lines)
- `packages/sdk/src/core/tools/index.ts` - Tools exports
- `packages/sdk/tests/unit/local-tool-handler.spec.ts` - 단위 테스트 (20+ tests)
- `packages/sdk/tests/integration/tool-calling.spec.ts` - 통합 테스트 (10+ tests)

**완료 조건**:
- [ ] 3개 local tools 구현 완료
- [ ] Tool 변환 로직 구현 완료
- [ ] HTTP tool handler 구현 완료
- [ ] 30개 이상 테스트 통과
- [ ] Tool calling loop 검증 완료

---

### WBS-22 MCP 통합 (⬜️ 대기)
> 📄 상세 계획: [wbs/wbs-22-mcp-integration.md](wbs/wbs-22-mcp-integration.md)

**목표**: MCP 서버 연결 및 MCP tools를 Vercel tools로 변환

**디펜던시**: WBS-21 (Tool Calling 시스템 필요)

- **Phase 1**: MCP Client 연구 (0.5일)
  - ⬜️ `@modelcontextprotocol/sdk` 분석
  - ⬜️ SowonFlow MCP 통합 패턴 연구 (@sowonflow_claude_dev에게 질의)
  - ⬜️ MCP server 연결 프로토콜 이해
  - ⬜️ MCP tools 스펙 분석
  - 산출물: `wbs/wbs-22-mcp-research.md`

- **Phase 2**: MCPClient 래퍼 구현 (1일)
  - ⬜️ `MCPClient` 클래스 구현
  - ⬜️ MCP server 연결 (`connect()`)
  - ⬜️ MCP tools 리스트 가져오기 (`getTools()`)
  - ⬜️ MCP server 설정 로딩 (YAML `mcp_servers` 섹션)
  - 파일: `packages/sdk/src/core/mcp/mcp-client.ts`

- **Phase 3**: MCP Tools 변환 (1일)
  - ⬜️ `convertMCPToolsToVercel()` 구현
  - ⬜️ MCP tool schema → Zod schema 변환
  - ⬜️ MCP tool execute 래퍼
  - ⬜️ 에러 핸들링 (MCP 서버 다운, timeout 등)

- **Phase 4**: BaseAPIProvider MCP 통합 (0.5일)
  - ⬜️ `initializeTools()` 메서드에 MCP tools 로딩 추가
  - ⬜️ MCP 서버 연결 라이프사이클 관리
  - ⬜️ MCP tools + local tools 병합

- **Phase 5**: MCP 통합 테스트 (1일)
  - ⬜️ Mock MCP server 구현
  - ⬜️ MCP 연결 테스트
  - ⬜️ MCP tools 변환 테스트
  - ⬜️ MCP tool 실행 테스트
  - ⬜️ 에러 시나리오 테스트
  - 파일: `packages/sdk/tests/unit/mcp-client.spec.ts`
  - 파일: `packages/sdk/tests/integration/mcp-integration.spec.ts`

**산출물**:
- `wbs/wbs-22-mcp-research.md` - MCP 연구 문서 (20+ 페이지)
- `packages/sdk/src/core/mcp/mcp-client.ts` - MCPClient (250+ lines)
- `packages/sdk/src/core/mcp/index.ts` - MCP exports
- `packages/sdk/tests/unit/mcp-client.spec.ts` - 단위 테스트 (15+ tests)
- `packages/sdk/tests/integration/mcp-integration.spec.ts` - 통합 테스트 (8+ tests)

**완료 조건**:
- [ ] MCPClient 구현 완료
- [ ] MCP tools 변환 로직 완료
- [ ] 23개 이상 테스트 통과
- [ ] Mock MCP server 검증 완료

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

- [SowonFlow 스펙 분석](wbs/wbs-19-sowonflow-spec-analysis.md) - SowonFlow YAML 구조 및 패턴 (@sowonflow_claude_dev에게 질의)
- [SowonFlow 프로덕션 코드](file:///Users/doha/git/sowonai/packages/sowonflow)
- [Vercel AI SDK 문서](https://sdk.vercel.ai/docs)
- [CrewX Provider 아키텍처](packages/sdk/src/core/providers/)
- [WBS-18 Provider 통합](wbs/wbs-18-agent-provider-integration.md)
