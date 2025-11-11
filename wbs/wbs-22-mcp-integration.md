[← WBS 개요](../wbs.md)

# WBS-22 MCP 통합

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-21 (Tool Calling 시스템 필요)
> **예상 소요**: 3-4일
> **우선순위**: P1

## 목표

MCP 서버 연결 및 MCP tools를 Vercel AI SDK tool()로 변환 (최소 구현)

## 접근 방식

Vercel AI SDK를 가볍게 사용:
- MCP는 **선택적 기능**으로 구현
- 복잡한 MCP Client 구현 없이 **단순 subprocess + stdio 통신**만
- MCP tool을 Vercel AI SDK `tool()` 형식으로 간단히 변환
- 에러 처리는 최소한으로 (연결 실패 시 graceful skip)

## Phase별 작업

### Phase 1: MCP 프로토콜 간단 이해 (0.3일)
- ⬜️ MCP stdio 프로토콜 기본 (JSON-RPC 요청/응답)
- ⬜️ list_tools, call_tool RPC 메서드만 파악
- ⬜️ 최소 구현 범위 결정 (연결 실패 시 skip)
- 산출물: `wbs/wbs-22-mcp-minimal-design.md` (간단한 설계 문서)

### Phase 2: MCP 서버 실행 헬퍼 (1일)
- ⬜️ 간단한 subprocess spawn 헬퍼
- ⬜️ stdin/stdout 기반 JSON-RPC 통신
- ⬜️ Tool list 가져오기 (list_tools RPC)
- 파일: `packages/sdk/src/core/mcp/mcp-helper.ts` (100 lines 이하)

### Phase 3: MCP → Vercel Tool 변환 (1일)
- ⬜️ MCP tool schema를 Vercel `tool()` 파라미터로 변환
- ⬜️ Tool call 시 MCP 서버 RPC 호출
- ⬜️ 에러 처리 (연결 실패 시 tool 제외)

### Phase 4: BaseAPIProvider 통합 (0.5일)
- ⬜️ YAML에서 `mcp_servers` 읽기
- ⬜️ MCP tools 로딩 (optional, 실패해도 진행)
- ⬜️ Local tools + MCP tools 병합

### Phase 5: 기본 테스트 (0.5일)
- ⬜️ Mock MCP 서버 간단 테스트
- ⬜️ Tool 변환 테스트
- ⬜️ 실패 시 graceful degradation 확인

## 산출물
- `wbs/wbs-22-mcp-minimal-design.md` - 최소 구현 설계
- `packages/sdk/src/core/mcp/mcp-helper.ts` - MCP 헬퍼 (100 lines)

## 완료 조건
- [ ] MCP 기본 연결 및 tool list 가져오기
- [ ] MCP tool을 Vercel tool로 변환
- [ ] 5개 이상 기본 테스트 통과
- [ ] **MCP 실패해도 API Provider는 정상 작동** (중요!)
