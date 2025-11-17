[← WBS 개요](../wbs.md)

# WBS-20 BaseAPIProvider 핵심 구현

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-19 (설계 완료 필요)
> **예상 소요**: 3-4일
> **우선순위**: P0

## 목표

Vercel AI SDK 기반 BaseAPIProvider 구현

## Phase별 작업

### Phase 1: 기본 구조 구현 (1일)
- ⬜️ `BaseAPIProvider` 클래스 뼈대 생성
- ⬜️ `AIProvider` 인터페이스 구현
- ⬜️ Model 초기화 로직 (OpenAI Compatible, Native OpenAI)
- 파일: `packages/sdk/src/core/providers/base-api.provider.ts`

### Phase 2: generateText 통합 (1일)
- ⬜️ `query()` 메서드 구현 (Vercel `generateText` 사용)
- ⬜️ `execute()` 메서드 구현
- ⬜️ System prompt 처리
- ⬜️ Temperature, maxTokens 파라미터 적용

### Phase 3: 기본 테스트 작성 (0.5일)
- ⬜️ Mock Provider 테스트
- ⬜️ OpenAI Compatible 초기화 테스트
- ⬜️ generateText 호출 테스트
- 파일: `packages/sdk/tests/unit/base-api-provider.spec.ts`

### Phase 4: isAvailable, getToolPath 구현 (0.5일)
- ⬜️ `isAvailable()` 구현 (health check)
- ⬜️ `getToolPath()` 구현

### Phase 5: SDK exports 업데이트 (0.5일)
- ⬜️ `packages/sdk/src/index.ts` 업데이트
- ⬜️ TypeScript 컴파일 검증
- ⬜️ `npm run build` 성공 확인

## 산출물
- `packages/sdk/src/core/providers/base-api.provider.ts` (300+ lines)
- `packages/sdk/tests/unit/base-api-provider.spec.ts` (15+ tests)

## 완료 조건
- [ ] 15개 이상 단위 테스트 통과
- [ ] TypeScript 컴파일 성공
- [ ] npm run build 성공
