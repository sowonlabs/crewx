[← WBS 개요](../wbs.md)

# WBS-26 문서화 및 예제

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-24 (CLI 통합 완료)
> **예상 소요**: 2-3일
> **우선순위**: P1

## 목표

사용 가이드, 예제, 마이그레이션 문서 작성

## Phase별 작업

### Phase 1: API Reference 문서 (1일)
- ⬜️ `BaseAPIProvider` API 문서
- ⬜️ `APIProviderConfig` 타입 문서
- ⬜️ Tool Calling API 문서
- 파일: `docs/api-provider-reference.md`

### Phase 2: 사용 가이드 (1일)
- ⬜️ Quick Start 가이드
- ⬜️ LiteLLM 설정 방법
- ⬜️ crewx.yaml 예제 (다양한 시나리오)
- 파일: `docs/api-provider-guide.md`

### Phase 3: 예제 코드 (0.5일)
- ⬜️ 기본 API agent 예제 (`examples/api-agent-basic/`)
- ⬜️ Tool calling 예제 (`examples/api-agent-tools/`)
- ⬜️ MCP 통합 예제 (`examples/api-agent-mcp/`)

### Phase 4: 마이그레이션 가이드 (0.5일)
- ⬜️ CLI provider → API provider 마이그레이션
- ⬜️ FAQ 섹션
- 파일: `docs/migration-to-api-provider.md`

## 산출물
- `docs/api-provider-reference.md` (30+ 페이지)
- `docs/api-provider-guide.md` (40+ 페이지)
- `docs/migration-to-api-provider.md`
- `examples/api-agent-basic/`
- `examples/api-agent-tools/`
- `examples/api-agent-mcp/`

## 완료 조건
- [ ] API Reference 문서 완성
- [ ] 사용 가이드 완성
- [ ] 3개 예제 코드 작성 및 검증
- [ ] 마이그레이션 가이드 완성
