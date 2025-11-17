[← WBS 개요](../wbs.md)

# WBS-23 YAML 파싱 및 Agent 생성

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-20 (BaseAPIProvider 필요)
> **예상 소요**: 2-3일
> **우선순위**: P0

## 목표

crewx.yaml에서 API provider 설정 파싱 및 Agent 생성

## Phase별 작업

### Phase 1: YAML 스키마 확장 (0.5일)
- ⬜️ `agents[].inline` 스키마 확장 (provider: "api" 추가)
- ⬜️ `mcp_servers` 섹션 추가
- ⬜️ `tools` 섹션 추가
- 파일: `packages/sdk/schema/crewx-config.json`

### Phase 2: Config 파서 확장 (1일)
- ⬜️ `parseAPIProviderConfig()` 함수 구현
- ⬜️ YAML → `APIProviderConfig` 변환
- ⬜️ 환경 변수 치환 (`{{env.VAR}}` 형식)
- 파일: `packages/sdk/src/config/api-provider-parser.ts`

### Phase 3: Dynamic Provider Factory 확장 (1일)
- ⬜️ `DynamicProviderFactory`에 API provider 지원 추가
- ⬜️ `createAPIProvider()` 메서드 구현
- 파일: `packages/sdk/src/core/providers/dynamic-provider.factory.ts`

### Phase 4: Agent Factory 통합 (0.5일)
- ⬜️ `AgentFactory`에서 API provider 지원
- ⬜️ WBS-18 Provider 주입 구조 활용

### Phase 5: 파싱 및 생성 테스트 (0.5일)
- ⬜️ YAML 파싱 테스트
- ⬜️ Provider factory 테스트

## 산출물
- `packages/sdk/src/config/api-provider-parser.ts` (200+ lines)
- `packages/sdk/tests/unit/api-provider-parser.spec.ts` (12+ tests)

## 완료 조건
- [ ] 20개 이상 테스트 통과
