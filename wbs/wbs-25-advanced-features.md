[← WBS 개요](../wbs.md)

# WBS-25 고급 기능 (Streaming)

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-24 (CLI 통합 완료)
> **예상 소요**: 1.5일
> **우선순위**: P2

## 목표

Streaming 응답 지원 (실시간 출력)

## 접근 방식

**Cost Tracking은 불필요**:
- BYOA 모델이므로 사용자가 직접 AI 서비스에 비용 지불
- CrewX SDK에서 비용 추적할 이유 없음
- 토큰 사용량은 각 AI 서비스 대시보드에서 확인

**Vercel AI SDK Streaming 가볍게 사용**:
- `streamText()` 함수로 실시간 응답
- CLI에서 점진적 출력만 지원하면 충분

## Phase별 작업

### Phase 1: Streaming 지원 (1일)
- ⬜️ `streamText()` 메서드 추가
- ⬜️ `queryStream()` 메서드 구현
- ⬜️ CLI에서 streaming 출력 지원
- 파일: `packages/sdk/src/core/providers/base-api.provider.ts`

### Phase 2: 기본 에러 핸들링 (0.5일)
- ⬜️ Stream 중단 처리
- ⬜️ Timeout 기본 제어
- ⬜️ 간단한 재시도 로직 (1-2회)

## 산출물
- `packages/sdk/src/core/providers/base-api.provider.ts` (Streaming 추가)

## 완료 조건
- [ ] Streaming 구현 및 테스트 완료
- [ ] CLI에서 실시간 출력 확인
- [ ] **Cost tracking 없이도 정상 작동** (중요!)
