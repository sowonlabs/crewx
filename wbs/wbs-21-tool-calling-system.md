[← WBS 개요](../wbs.md)

# WBS-21 Tool Calling 시스템 구현

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-20 (BaseAPIProvider 필요)
> **예상 소요**: 1-2일
> **우선순위**: P0

## 목표

Vercel AI SDK tool() 사용하여 간단한 Tool Calling 구현

## 접근 방식

**로컬 파일 조작은 불필요**:
- API Provider는 서버 환경에서 실행
- 로컬 파일 읽기/쓰기가 필요하면 **CLI Provider** 사용 (코딩 에이전트)
- API Provider는 **HTTP tools만** 지원하면 충분

**Vercel AI SDK 가볍게 사용**:
- Vercel AI SDK `tool()` 함수로 직접 정의
- 별도의 Handler 클래스 불필요
- 간단한 HTTP tool만 구현

## Phase별 작업

### Phase 1: Vercel AI SDK tool() 기본 사용 (0.5일)
- ⬜️ Vercel AI SDK `tool()` 함수 사용법 확인
- ⬜️ generateText에 tools 전달 방법
- ⬜️ maxSteps 설정 방법
- 산출물: `wbs/wbs-21-tool-calling-minimal.md`

### Phase 2: HTTP Tool 정의 (0.5일)
- ⬜️ HTTP POST/GET tool 간단 구현
- ⬜️ Vercel AI SDK `tool()` 형식으로 정의
- ⬜️ YAML에서 tool 설정 읽기
- 파일: `packages/sdk/src/core/tools/http-tool.ts` (50 lines)

### Phase 3: BaseAPIProvider 통합 (0.5일)
- ⬜️ generateText에 tools 전달
- ⬜️ maxSteps 설정 (tool calling loop)
- ⬜️ Tool execution 결과 처리

### Phase 4: 기본 테스트 (0.5일)
- ⬜️ HTTP tool 테스트 (mock fetch)
- ⬜️ generateText + tools 통합 테스트
- ⬜️ Tool calling loop 테스트

## 산출물
- `wbs/wbs-21-tool-calling-minimal.md` - 최소 구현 설계
- `packages/sdk/src/core/tools/http-tool.ts` - HTTP Tool (50 lines)

## 완료 조건
- [ ] HTTP tool 구현 완료
- [ ] generateText + tools 통합
- [ ] 5개 이상 기본 테스트 통과
- [ ] **로컬 파일 tool 없이도 정상 작동** (중요!)
