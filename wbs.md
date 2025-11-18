# CrewX WBS - API Provider Implementation

> 상태: `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `🔄 보류`

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [진행 현황](#진행-현황)
3. [WBS-19: API Provider 설계](#wbs-19-api-provider-설계-및-기획--완료)
4. [WBS-20: Mastra 통합](#wbs-20-mastra-통합-구현--완료)
5. [WBS-21: Tool Calling 구현](#wbs-21-tool-calling-구현--진행중)
6. [WBS-23: YAML 파싱](#wbs-23-yaml-파싱-및-agent-생성--완료)
7. [WBS-24: CLI 통합](#wbs-24-cli-통합--완료)
8. [WBS-26: 문서화](#wbs-26-문서화-및-예제--완료)
9. [WBS-28: Provider 스펙 설계](#wbs-28-provider-스펙-호환성-설계--진행중)
10. [WBS-27: Coordinator Loop](#wbs-27-coordinator-loop-개선--보류)
11. [WBS-29: Slack Bot Network Isolation](#wbs-29-slack-bot-network-isolation-문제--대기)
12. [WBS-30: Marketplace MVP](#wbs-30-marketplace-mvp--대기)
13. [WBS-32: Project Templates](#wbs-32-project-templates-create--대기)
14. [참고 문서](#참고-문서)

---

## 프로젝트 개요

**목표**: API Provider 구현으로 LiteLLM 게이트웨이 지원 및 Tool Calling 통합

**배경**:
- 기존: CLI Provider (spawn 기반)
- 신규: API Provider (HTTP + Tool Calling)

**기술 스택**: Vercel AI SDK, Mastra, Zod

**총 소요**: ~~3-4주~~ → **1.5-2주** (Mastra 통합으로 50% 단축)

---

## 진행 현황

| 상태  | ID         | 작업명                         | 산출물                | 소요       | 우선순위   |
| --- | ---------- | --------------------------- | ------------------ | -------- | ------ |
| ✅   | WBS-19     | API Provider 설계             | 아키텍처, YAML 스펙      | 2-3일     | P0     |
| ✅   | WBS-20     | Mastra 통합                   | 7 Providers 구현     | 3일       | P0     |
| ✅   | **WBS-21** | **Tool Calling 구현**         | **Built-in Tools** | **2-3일** | **P0** |
| ✅   | ~~WBS-22~~ | ~~MCP 통합~~                  | ~~Mastra 제공~~      | 0일       | -      |
| ✅   | WBS-23     | YAML 파싱                     | Provider Factory   | 2-3일     | P0     |
| ✅   | WBS-24     | CLI 통합                      | CLI 명령어 지원         | 1-2일     | P0     |
| ✅   | WBS-26     | 문서화                         | 가이드, 예제            | 2-3일     | P1     |
| ✅   | WBS-28     | Provider 스펙 설계              | options 통합         | 3-4일     | P0     |
| 🔄  | WBS-27     | Coordinator Loop            | 로그 기반 추적 (보류)      | 3-5일     | P2     |
| 🔄  | WBS-29     | Slack Bot Network Isolation | Codex 네트워크 제한 해결   | 1-2일     | P2     |
| 🔄  | WBS-25     | 고급 기능                       | Streaming, Cost    | 3일       | P2     |
| 🔄  | WBS-30     | Marketplace MVP (전략)       | 비즈니스 모델 설계      | 완료      | P2     |
| 🔄  | WBS-31     | Marketplace 구현 (Phase 1)   | 실제 웹사이트 구축      | 4일       | P2     |
| 🟡  | WBS-32     | Project Templates (create)   | crewx template 스캐폴딩   | 3-4일     | P0     |

---

## WBS-19: API Provider 설계 및 기획 (✅ 완료)
> 📄 [wbs/wbs-19-design-document.md](wbs/wbs-19-design-document.md)

**산출물**:
- 아키텍처 다이어그램
- YAML 스펙 정의
- TypeScript 타입 시스템
- Mastra 통합 전략

---

## WBS-20: Mastra 통합 구현 (✅ 완료)
> 📄 [wbs/wbs-20-mastra-integration.md](wbs/wbs-20-mastra-integration.md)

**산출물**:
- MastraAPIProvider 구현
- MastraToolAdapter
- 7 Providers 지원 (OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI)
- 36개 E2E 테스트 통과

---

## WBS-21: Tool Calling 구현 (✅ 완료)

**목표**: Gemini CLI의 Built-in Tools를 CrewX API Provider로 이식

**현재 상태**: All phases completed ✅ (2025-01-13)

### 🔧 중요 해결: OpenRouter Tool Calling 이슈

**문제**: OpenRouter 사용 시 tool calling 동작 안함
- `createOpenAI()` + baseURL로 OpenRouter 연결 시 tool 무시
- `tool_choice: "required"` 전달해도 효과 없음

**해결**: `@openrouter/ai-sdk-provider` 전용 SDK 사용
- MastraAPIProvider가 URL에서 `openrouter.ai` 감지 시 자동으로 OpenRouter SDK 사용
- 패키지 추가: `@openrouter/ai-sdk-provider`
- 검증: `gpt-4o-mini`, `gpt-oss-20b` 모두 tool calling 성공

**관련**: WBS-28 (Provider Options 설계 문서에 상세 기록)

### Phase 1: read_file Tool 이식 (✅ 완료)

**발견된 문제**: Mastra `createTool()` 형식 필요

**해결 완료**:
- ✅ read-file.tool.ts를 Mastra `createTool()` 형식으로 수정
- ✅ Execute signature 수정: `async ({ context }) => { const { file_path, offset, limit } = context; }`
- ✅ ai-provider.service.ts 타입 수정 (any[] 허용)
- ✅ MastraAPIProvider.setTools() 타입 업데이트
- ✅ TypeScript 빌드 통과 확인

**주요 변경사항**:
1. Tool 정의: `createTool({ id, inputSchema, outputSchema, execute })` 사용
2. 필드명: `name` → `id`, `parameters` → `inputSchema`
3. Execute signature: `async ({ context }) => { const { args } = context; }`
4. Type system: `FrameworkToolDefinition | Mastra Tool` 모두 허용

**완료 커밋**: dac8ec6

**다음 단계**: Management approval for next features (WBS-25, WBS-28)

**참고**:
- Mastra 공식 문서: https://mastra.ai/reference/tools/create-tool
- Mastra ToolExecutionContext: https://mastra.ai/en/docs/tools-mcp/dynamic-context

### Phase 2: 추가 Tools 이식 (✅ 완료)
- [x] replace (edit) tool
- [x] run_shell_command tool
- [x] ls (list_directory) tool
- [x] write_file tool
- [x] grep (search) tool

### Phase 3: Built-in Tools 통합 (✅ 완료)
- [x] 6개 built-in tools 로딩 (read_file, write_file, replace, ls, grep, run_shell_command)
- [x] Tool export 및 integration
- [x] 빌드 및 검증

**Note**: MCP server integration은 Mastra instance level에서 처리됨. 현재는 built-in tools만 API Provider에서 사용 가능.

---

## WBS-23: YAML 파싱 및 Agent 생성 (✅ 완료)
> 📄 [wbs/wbs-23-yaml-parsing-agent-factory.md](wbs/wbs-23-yaml-parsing-agent-factory.md)

**산출물**:
- YAML 파서 (420+ lines)
- Provider Factory 통합
- 36개 단위 테스트 통과

---

## WBS-24: CLI 통합 (✅ 완료)
> 📄 [wbs/wbs-24-cli-integration.md](wbs/wbs-24-cli-integration.md)

**산출물**:
- `crewx q`, `crewx execute`, `crewx chat` 지원
- `crewx doctor` API provider 체크
- 13개 통합 테스트

---

## WBS-26: 문서화 및 예제 (✅ 완료)
> 📄 [wbs/wbs-26-documentation-examples.md](wbs/wbs-26-documentation-examples.md)

**산출물**:
- API Reference (30+ 페이지)
- 사용 가이드 (40+ 페이지)
- 마이그레이션 가이드 (30+ 페이지)
- 3개 예제 (basic, tools, mcp)

---

## WBS-28: Provider 스펙 호환성 설계 (✅ 완료)
> 📄 [wbs/wbs-28-provider-options-design.md](wbs/wbs-28-provider-options-design.md)

**목표**: CLI/API Provider options 스펙 통합 및 Tool 권한 제어

**현재 상태**: 전체 Phase 완료 (설계, 타입, 구현, 테스트, 문서화)

### Phase 1: 설계 (✅ 완료)
- ✅ 문제 정의
- ✅ 3가지 방안 도출
- ✅ **의사결정 완료: 방안 2 선택**
  - `options.query/execute` 객체 확장
  - 레거시 배열 지원
  - 기본값: 빈 배열 (안전 우선)

### 최종 스펙

```yaml
# API Provider (신규)
agents:
  - name: claude_api
    provider: api/anthropic
    options:
      query:                     # CLI와 키 이름 동일
        tools: [file_read, grep]
        mcp: [filesystem]
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem, git]

# 레거시 지원
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]  # 자동 변환: options.execute로
```

### Phase 2: 타입 구현 (✅ 완료)
- ✅ TypeScript 타입 (Discriminated Union)
- ✅ Zod 스키마
- ✅ JSON Schema

### Phase 3: Provider 구현 (✅ 완료)
- ✅ MastraAPIProvider 수정
- ✅ normalizeAPIProviderConfig 함수
- ✅ 모드별 필터링 로직

### Phase 4: 테스트 (✅ 완료)
- ✅ 단위 테스트 (106 tests - 목표 15+ 초과 달성)
  - api-provider-types.spec.ts: 33 tests (타입 가드, 레거시 감지, 변환)
  - api-provider-schema.spec.ts: 33 tests (Zod 스키마 검증)
  - api-provider-normalizer.spec.ts: 28 tests (정규화, 모드 필터링)
- ✅ 통합 테스트 (api-provider-integration.spec.ts: 12 tests)
- ✅ 레거시 변환 테스트
- ✅ 엣지 케이스 및 에러 처리

### Phase 5: 문서화 (✅ 완료)
- ✅ API Provider 가이드 업데이트 (Provider Options 섹션)
- ✅ 마이그레이션 가이드 (tools/mcp 필드 변환 예제)
- ✅ 예제 추가 (api-provider-with-tools.yaml, api-provider-with-mcp.yaml, api-provider-modes.yaml)

---

## WBS-27: Coordinator Loop 개선 (🔄 보류)

**목표**: Worker Agent 로그 분석을 통한 작업 완료 자동 감지

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**핵심 아이디어**:
- Coordinator가 Worker Agent 로그 분석
- wbs.md 자동 업데이트 (Self-Healing)
- 5분마다 체크 (비용 무료)

---

## WBS-29: Slack Bot Network Isolation 문제 (🔄 보류)
> 📄 [wbs/wbs-29-slack-network-isolation.md](wbs/wbs-29-slack-network-isolation.md)

**목표**: Slack Bot에서 실행되는 Codex Provider의 네트워크 접근 제한 해결

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**산출물**:
- 네트워크 환경 분석 보고서
- 해결 방안 구현
- Slack Bot 배포 가이드

---

## WBS-30: Marketplace MVP - 전략 문서 (🔄 보류)
> 📄 [wbs/wbs-30-marketplace-mvp.md](wbs/wbs-30-marketplace-mvp.md)

**목표**: 마켓플레이스 비즈니스 모델 및 전략 수립

**상태**: 🔄 보류 (전략 완료됨, 구현은 WBS-32 이후 재검토)

**핵심 전략**:
- 3-Tier 모델 (무료/유료/엔터프라이즈)
- IP 보호 (AES-256 암호화 + 라이선스 검증)
- 로깅 시스템 (3-level: Public/Developer/Protected)

**아키텍처**: Registry(JSON) + Git Storage + Astro Frontend

**산출물**:
- ✅ 비즈니스 모델 설계
- ✅ 기술 스택 결정 (Astro + Prisma + NestJS)
- ✅ 3-Phase 로드맵
- ✅ 비용 구조 분석

**기술적 실현 가능성**: ✅ 100% 가능 (난이도: 중)

**상태**: 전략 승인 완료, WBS-31로 구현 진행

---

## WBS-31: Marketplace 구현 (Phase 1 - MVP) (🔄 보류)
> 📄 [wbs/wbs-31-marketplace-implementation.md](wbs/wbs-31-marketplace-implementation.md)

**목표**: 투자자 데모용 실제 웹사이트 구축 (3일, 30분 단위 작업)

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**⚠️ MVP 전용**: 프로덕션은 Phase 2에서 재구축 예정

**기술 스택** (⚠️ MVP 전용):
- **Framework**: Astro 4.x 하이브리드 (정적 + SSR + Serverless)
- **Database**: Prisma 5.x + PostgreSQL (Supabase)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (완전 무료)

**프로젝트 구조** (단일 프로젝트):
```
crewx-marketplace/
├── prisma/         # DB 스키마 + Seed
├── src/
│   ├── pages/      # Astro 페이지 (정적 + SSR)
│   │   └── api/    # Serverless Functions
│   ├── components/ # UI 컴포넌트
│   └── lib/        # Prisma Client
└── public/
```

**구현 계획** (30분 단위):
- **Day 1**: Astro + Prisma + Supabase 세팅 (3.5h)
- **Day 2**: 데이터 + UI (API Routes + 홈/상세 페이지) (3.5h)
- **Day 3**: 검색 + Vercel 배포 + 데모 준비 (3h)

**산출물**:
- ✅ crewx-marketplace Git 프로젝트
- ✅ 작동하는 웹사이트 (marketplace.crewx.dev)
- ✅ 투자자 데모 스크립트
- ✅ 10개 샘플 Agent 데이터

**Phase 1 MVP 범위**:
```
포함:
✅ Agent 목록/상세 페이지
✅ 검색/필터 기능
✅ CLI 설치 명령어 복사
✅ 정적 배포

제외 (Phase 2+):
❌ 암호화/라이선스
❌ 결제 시스템
❌ 리뷰/레이팅
```

**다음 단계**: WBS-31 착수 승인 대기

---

## WBS-32: Project Templates (crewx template) (🟡 진행중)
> 📄 [wbs/wbs-32-project-templates.md](wbs/wbs-32-project-templates.md)

**목표**: `crewx template` 서브커맨드 기반 프로젝트 스캐폴딩 시스템 구축

**예상 소요**: 2-3일 (AI 작업 기준, 12-16시간)

**시작**: 2025-01-18 11:30
**완료**: 미정
**실제 소요**: (진행중)

**완료 시 할 수 있는 것**:
- `crewx template init wbs-automation`으로 프로젝트 생성
- `crewx template list`로 사용 가능한 템플릿 목록 확인
- `crewx template show wbs-automation`으로 템플릿 상세 정보 확인
- WBS 자동화 봇을 5분 만에 시작 가능
- Docusaurus 문서 관리 봇을 즉시 배포 가능

**Phase 진행 상황**:
- [ ] Phase 1: CLI 명령어 구조 (4-5시간) - 담당: crewx_claude_dev
- [ ] Phase 2: WBS Automation 템플릿 (3-4시간) - 담당: crewx_codex_dev
- [ ] Phase 3: 추가 템플릿 (3-4시간) - 담당: crewx_crush_dev
- [ ] Phase 4: 문서화 (2-3시간) - 담당: crewx_claude_dev

**작업 시간 추적** (Coordinator 자동 기록):
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | - | - | - | - | 4-5h | ⬜️ |
| Phase 2 | - | - | - | - | 3-4h | ⬜️ |
| Phase 3 | - | - | - | - | 3-4h | ⬜️ |
| Phase 4 | - | - | - | - | 2-3h | ⬜️ |

---

## 참고 문서

### WBS 상세 계획
- [WBS-19: API Provider 설계](wbs/wbs-19-design-document.md)
- [WBS-20: Mastra 통합](wbs/wbs-20-mastra-integration.md)
- [WBS-23: YAML 파싱](wbs/wbs-23-yaml-parsing-agent-factory.md)
- [WBS-24: CLI 통합](wbs/wbs-24-cli-integration.md)
- [WBS-26: 문서화](wbs/wbs-26-documentation-examples.md)
- [WBS-28: Provider 스펙 설계](wbs/wbs-28-provider-options-design.md)
- [WBS-29: Slack Bot Network Isolation](wbs/wbs-29-slack-network-isolation.md)
- [WBS-30: Marketplace MVP (전략)](wbs/wbs-30-marketplace-mvp.md)
- [WBS-31: Marketplace 구현 (Phase 1)](wbs/wbs-31-marketplace-implementation.md)
- [WBS-32: Project Templates](wbs/wbs-32-project-templates.md)

### 구현 문서
- [API Provider 가이드](docs/api-provider-guide.md)
- [마이그레이션 가이드](docs/migration-to-api-provider.md)
- [SowonFlow 스펙 분석](wbs/wbs-19-sowonflow-spec-analysis.md)

### 코드
- [MastraAPIProvider](packages/sdk/src/core/providers/MastraAPIProvider.ts)
- [MastraToolAdapter](packages/sdk/src/adapters/MastraToolAdapter.ts)
- [API Provider Types](packages/sdk/src/types/api-provider.types.ts)
