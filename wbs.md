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
12. [참고 문서](#참고-문서)

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

| 상태 | ID | 작업명 | 산출물 | 소요 | 우선순위 |
|------|----|----|-------|------|---------|
| ✅ | WBS-19 | API Provider 설계 | 아키텍처, YAML 스펙 | 2-3일 | P0 |
| ✅ | WBS-20 | Mastra 통합 | 7 Providers 구현 | 3일 | P0 |
| ✅ | **WBS-21** | **Tool Calling 구현** | **Built-in Tools** | **2-3일** | **P0** |
| ✅ | ~~WBS-22~~ | ~~MCP 통합~~ | ~~Mastra 제공~~ | 0일 | - |
| ✅ | WBS-23 | YAML 파싱 | Provider Factory | 2-3일 | P0 |
| ✅ | WBS-24 | CLI 통합 | CLI 명령어 지원 | 1-2일 | P0 |
| ✅ | WBS-26 | 문서화 | 가이드, 예제 | 2-3일 | P1 |
| 🟡 | **WBS-28** | **Provider 스펙 설계** | **options 통합** | **3-4일** | **P0** |
| 🔄 | WBS-27 | Coordinator Loop | 로그 기반 추적 (보류) | 3-5일 | P1 |
| ⬜️ | WBS-29 | Slack Bot Network Isolation | Codex 네트워크 제한 해결 | 1-2일 | P1 |
| ⬜️ | WBS-25 | 고급 기능 | Streaming, Cost | 3일 | P2 |

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

**현재 상태**: All phases completed ✅

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

## WBS-28: Provider 스펙 호환성 설계 (🟡 진행중)
> 📄 [wbs/wbs-28-provider-options-design.md](wbs/wbs-28-provider-options-design.md)

**목표**: CLI/API Provider options 스펙 통합 및 Tool 권한 제어

**현재 상태**: Phase 1 완료, 의사결정 완료

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

### Phase 3: Provider 구현 (⬜️ 대기)
- [ ] MastraAPIProvider 수정
- [ ] normalizeAPIProviderConfig 함수
- [ ] 모드별 필터링 로직

### Phase 4: 테스트 (⬜️ 대기)
- [ ] 단위 테스트 (15+ tests)
- [ ] 통합 테스트
- [ ] 레거시 변환 테스트

### Phase 5: 문서화 (⬜️ 대기)
- [ ] API Provider 가이드 업데이트
- [ ] 마이그레이션 가이드
- [ ] 예제 추가

---

## WBS-27: Coordinator Loop 개선 (🔄 보류)

**목표**: Worker Agent 로그 분석을 통한 작업 완료 자동 감지

**상태**: 보류 (API Provider 완료 후 별도 브랜치에서 진행 예정)

**핵심 아이디어**:
- Coordinator가 Worker Agent 로그 분석
- wbs.md 자동 업데이트 (Self-Healing)
- 5분마다 체크 (비용 무료)

---

## WBS-29: Slack Bot Network Isolation 문제 (⬜️ 대기)
> 📄 [wbs/wbs-29-slack-network-isolation.md](wbs/wbs-29-slack-network-isolation.md)

**목표**: Slack Bot에서 실행되는 Codex Provider의 네트워크 접근 제한 해결

**산출물**:
- 네트워크 환경 분석 보고서
- 해결 방안 구현
- Slack Bot 배포 가이드

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

### 구현 문서
- [API Provider 가이드](docs/api-provider-guide.md)
- [마이그레이션 가이드](docs/migration-to-api-provider.md)
- [SowonFlow 스펙 분석](wbs/wbs-19-sowonflow-spec-analysis.md)

### 코드
- [MastraAPIProvider](packages/sdk/src/core/providers/MastraAPIProvider.ts)
- [MastraToolAdapter](packages/sdk/src/adapters/MastraToolAdapter.ts)
- [API Provider Types](packages/sdk/src/types/api-provider.types.ts)
