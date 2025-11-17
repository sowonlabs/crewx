[← WBS 개요](../wbs.md)

# WBS-24 CLI 통합

> **상태**: ⬜️ 대기
> **디펜던시**: WBS-23 (YAML 파싱 필요)
> **예상 소요**: 2-3일
> **우선순위**: P0

## 목표

CLI 명령어에서 API provider 사용 가능하도록 통합

## Phase별 작업

### Phase 1: CLI Config 로더 업데이트 (0.5일)
- ⬜️ `ConfigService`에서 API provider config 로딩
- 파일: `packages/cli/src/config/config.service.ts`

### Phase 2: Agent Loader 업데이트 (0.5일)
- ⬜️ `AgentLoaderService`에서 API provider 지원
- 파일: `packages/cli/src/services/agent-loader.service.ts`

### Phase 3: CLI 명령어 지원 (0.5일)
- ⬜️ `crewx q` 명령어에서 API agent 지원
- ⬜️ `crewx execute` 명령어에서 API agent 지원
- ⬜️ `crewx chat` 명령어에서 API agent 지원

### Phase 4: Doctor 명령어 업데이트 (0.5일)
- ⬜️ `crewx doctor` API provider 헬스 체크 추가
- 파일: `packages/cli/src/handlers/doctor.handler.ts`

### Phase 5: CLI 통합 테스트 (0.5일)
- ⬜️ API agent 로딩 테스트
- ⬜️ Query/Execute 명령어 테스트

## 산출물
- `packages/cli/tests/integration/api-provider-cli.spec.ts` (10+ tests)

## 완료 조건
- [ ] 10개 이상 CLI 통합 테스트 통과
- [ ] 회귀 테스트 통과 (기존 기능 정상)
