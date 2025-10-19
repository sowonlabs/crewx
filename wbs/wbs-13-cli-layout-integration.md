# WBS-13: CLI 레이아웃 통합 상세 계획

## 목적
- CLI에서 SDK 레이아웃 스택(LayoutLoader / PropsValidator / LayoutRenderer)을 직접 사용하도록 통합한다.
- CLI 고유 UX(템플릿 캐시, Nest 의존성, CLI 포맷팅)를 유지하면서 중복 구현을 제거한다.

## 범위
- `inline.layout` 및 props 정의가 포함된 YAML을 CLI가 SDK를 통해 동일하게 처리하도록 리팩토링.
- CLI가 별도로 유지하던 템플릿/문서/유틸 로직을 SDK 호출로 대체하거나 SDK 결과를 활용하는 방식으로 정리.
- 전역 설치(dev 패키지) 시나리오에서 레이아웃 렌더링이 스펙(WBS-11)과 일치하는지 검증.

## 산출물
- SDK 레이아웃 스택을 사용하는 CLI 코드 (에이전트 로더, 템플릿 처리, 문서 로딩 등).
- CLI 회귀 테스트 및 전역 설치 검증 결과.
- 업데이트된 문서(README, GUIDE_KR, RELEASE 등 필요 시).

## 현황 분석 (중복/레거시 로직)
- **mention-parser 중복**: `packages/cli/src/utils/mention-parser.ts`와 SDK 동명 파일이 거의 동일한 구현을 유지. CLI 측 파일 삭제 후 SDK 버전으로 통일 필요.
- **레거시 AIService 메서드**: `packages/cli/src/ai.service.ts` 내 `queryClaudeCLI`, `queryGeminiCLI`, `executeGeminiCLI`, `queryCopilotCLI` 등이 SDK `BaseAIProvider` 로직을 중복. 호출 경로 확인 후 `queryAI`/`executeAI` 위임으로 통합해야 함.
- **Provider 래퍼 보일러플레이트**: `packages/cli/src/providers/*.provider.ts`가 SDK 프로바이더를 thin wrapper로 감싸며 중복 코드(로거 어댑터 주입)만 수행. 팩토리/제네릭 래퍼 도입으로 통합 가능.
- **DynamicProviderFactory 범용 로직**: `packages/cli/src/providers/dynamic-provider.factory.ts`가 범용 프로바이더 생성 및 보안 검증 로직을 혼재. 코어 생성 로직은 SDK로 승격하고 CLI 특화 검증만 남길 필요.
- **대화 기록/에러 처리**: `packages/cli/src/conversation` 및 `ai.service.ts`에서 에러 파싱·로그 처리 등이 SDK와 이중화. Phase 2 이후 정리 대상으로 포함.

## 작업 항목

### Phase 1: CLI 서비스 → SDK 레이아웃 스택 전환

1. **에이전트 로딩 경로 리팩터링**
   - 대상: `packages/cli/src/services/agent-loader.service.ts`, `packages/cli/src/crewx.tool.ts`
   - `inline.layout`/props를 파싱해 SDK `LayoutLoader`, `LayoutRenderer`, `PropsValidator`를 호출하도록 변경
   - `inline.system_prompt`는 fallback으로 유지하되 `inline.layout` 우선 처리
   - Nest DI로 SDK 서비스 인스턴스를 주입하거나 필요한 팩토리 함수를 구성

2. **템플릿/문서 파이프라인 통합**
   - 대상: `packages/cli/src/utils/template-processor.ts`, `packages/cli/src/services/document-loader.service.ts`
   - SDK `DocumentManager`/`DocumentLoader` 활용 여부 결정
   - 기존 Handlebars 기반 처리 대신 SDK 렌더링 결과를 사용하거나 최소한 SDK 결과와 호환되도록 조정
   - CLI 고유 컨텍스트(`security_key`, tools 정보 등)를 SDK 렌더링 컨텍스트에 포함시키는 방법 설계

3. **중복 유틸 제거**
   - 대상: `packages/cli/src/utils/mention-parser.ts`, `packages/cli/src/utils/stdin-utils.ts`
   - SDK 제공 `mention-parser`, `parseStructuredPayload` 등으로 교체
   - deprecated 주석 제거 및 관련 테스트 업데이트

4. **의존성 및 빌드 구성 정리**
   - CLI `package.json`에서 사용하지 않게 되는 의존성 제거(예: 직접 사용하는 `handlebars`)
   - Nest 모듈(`packages/cli/src/app.module.ts`)에서 SDK 서비스가 정상 주입되는지 확인
    - 빌드 스크립트(`scripts/postbuild-cli.mjs` 등)와 번들 설정(`tsconfig.json`) 점검

5. **최소 테스트 추가**
   - CLI 단위/통합 테스트로 레이아웃 렌더링 경로 검증
   - SDK dev 버전 전역 설치 후 실제 `crewx` 명령에서 레이아웃이 동작하는지 로컬 확인

### Phase 2: 코어 중복 로직 정리

1. **AIService 레거시 경로 제거**
   - `ai.service.ts`의 `queryClaudeCLI`, `queryClaudeWithPermissions`, `queryGeminiCLI`, `executeGeminiCLI`, `queryCopilotCLI` 호출처 조사 후 `queryAI`/`executeAI`로 경로 통합
   - 중복된 spawn/stdout/timeout 로직 제거, SDK `BaseAIProvider` 로깅/에러 핸들링을 단일 소스로 사용
   - 필요 시 Task 로그 생성/저장 기능을 SDK 쪽 헬퍼로 위임

2. **Provider 주입 구조 단순화**
   - `packages/cli/src/providers/*.provider.ts`를 제네릭 팩토리 또는 Nest provider factory로 통합
   - 로거 어댑터/툴콜 서비스 주입 패턴을 한 곳으로 모아 코드 중복(~60 LOC) 제거
   - Dynamic provider 생성 시 SDK 팩토리를 재사용하게 연결

3. **공유 유틸 SDK 의존으로 전환**
   - `mention-parser.ts` CLI 파일 제거 → SDK export 사용
   - `stdin-utils.ts`의 `parseStructuredPayload` 등 deprecated 로직 제거하고 SDK API로 교체
   - Conversation history/결과 포매터가 SDK 구현(`BaseMessageFormatter`, `ConversationStorageService`)을 직접 활용하도록 점검

4. **DynamicProviderFactory 역할 분리**
   - 범용 생성/정규화 로직을 SDK에 이동시키고, CLI에서는 보안 검증·환경 변수 확인만 담당
   - Remote provider/플러그인 경로가 SDK 타입(`RemoteAgentManager`)과 정합성을 유지하도록 수정

### Phase 3: 통합 검증 및 회귀 테스트

1. **dev 빌드·전역 설치 검증**
   - `npm pack` → `npm install -g` 흐름으로 CLI를 설치하고 `inline.layout`이 포함된 YAML을 대상으로 query/execute 테스트
   - 템플릿 캐시, GitHub 다운로드 등 기존 CLI 기능과의 충돌 여부 확인

2. **회귀 테스트 보강**
   - Mention parsing, stdin 파이프, remote agent 등 기존 기능이 정상 동작하는지 확인
   - 필요 시 새로운 vitest/통합 테스트 추가

3. **문서/릴리스 노트 업데이트**
   - README, GUIDE_KR, RELEASE.md 등에 변경된 사용법 및 주의사항 반영

4. **QA 체크리스트**
   - CLI & SDK 버전 호환성 점검
   - Slack/MCP 모드에서 레이아웃 변경 영향 검토

## 위험 요소
- 대규모 리팩터링으로 인한 회귀 가능성
- CLI와 SDK 버전 매트릭스 관리 부담
- 전역 설치 환경에서의 의존성 충돌 가능성

## 대응 전략
- Phase 1 완료 직후 dev 빌드·전역 설치 검증을 수행해 빠르게 회귀 여부 확인
- 자동화 테스트와 수동 QA를 병행, 필요 시 간단한 e2e 스크립트 도입
- 변경 사항을 문서화해 사용자 혼란 최소화

## 참고
- 선행 작업: WBS-11(스펙), WBS-12(SDK 구현)
- 참고 문서: `wbs/wbs-11-layout-spec.md`, `templates/agents/default.yaml`
- 관련 테스트: `packages/cli/tests`, `packages/sdk/tests`
