# CrewX WBS

> 상태 표시는 `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⚠️ 위험` 등으로 업데이트해 주세요.

## 현황

| 상태     | ID    | 작업명             | 주요 산출물 및 범위                                   | 선행 디펜던시 | 병행 가능성/메모                                       |
| ------ | ----- | ----------------- | ----------------------------------------------- | ---------- | ------------------------------------------------- |
| ✅ 완료   | WBS-11 | 레이아웃 시스템 기획 | 레이아웃 DSL 정의, 로더 설계 (단순화) | WBS-10     | Phase 1-2 완료 (2025-10-18): DSL 명세, 로더 아키텍처 |
| ✅ 완료 | WBS-12 | 레이아웃 시스템 구현 | LayoutLoader, PropsValidator, LayoutRenderer 구현 | WBS-11     | Phase 1-4 완료 (2025-10-18): 3개 서비스 구현 및 아키텍처 검토 완료. 사이클 #3 완료 (2025-10-19): WBS-12-FIX-1, FIX-2, FIX-3, FIX-4 리팩토링 및 테스트 보강 완료 |
| 🟡 진행중 | WBS-13 | CLI 레이아웃 통합 | CLI가 SDK LayoutLoader/Renderer/PropsValidator를 사용해 `inline.layout` YAML을 처리하도록 통합 | WBS-12 | **Phase 1 완료 (2025-10-19)**: SDK 레이아웃 스택 통합 완료. **Phase 2 완료 (2025-10-19)**: 코어 중복 로직 정리 및 SDK 연동. |

## 상세 작업 계획

> ℹ️ 완료된 WBS의 요약 및 산출물은 [wbs/archive.md](wbs/archive.md)에서 확인할 수 있습니다.

### WBS-11 레이아웃 시스템 기획 (✅ 완료, 단순화)
> 📄 상세 계획: [wbs/wbs-11-layout-plan.md](wbs/wbs-11-layout-plan.md)
- Phase 1: 레이아웃 DSL 요구사항 정리 — ✅ 완료 (2025-10-18)
  - 📄 [wbs/wbs-11-layout-spec.md](wbs/wbs-11-layout-spec.md)
- Phase 2: 레이아웃 로더 구현 설계 (단순화) — ✅ 완료 (2025-10-18)
  - 📄 [wbs/wbs-11-registry-loader.md](wbs/wbs-11-registry-loader.md)

**완료 요약:**
- 레이아웃 DSL 명세 정의 (inline.layout 문자열/Object 형식, **React PropTypes 스타일** Props 스키마)
- CrewX 레이아웃 로딩 구조 (`templates/agents/*.yaml`, 네임스페이스 `crewx/*`)
- crewx.yaml에서 Props 오버라이드 방식
- Props 검증 흐름 (React PropTypes 호환)
- 간소화된 Fallback 전략 (`crewx/default`)

### WBS-12 레이아웃 시스템 구현 (✅ 완료)
> 📄 상세 계획: WBS-11 결과 문서 참조
- 작업 패키지: `packages/sdk` (sdk에서도 yaml을 사용하니 꼭 sdk에 작업할 것!)
- Phase 1: LayoutLoader 구현 — ✅ 완료 (2025-10-18)
  - ✅ TypeScript 인터페이스 정의 (`packages/sdk/src/types/layout.types.ts`)
  - ✅ LayoutLoader 서비스 구현 (`packages/sdk/src/services/layout-loader.service.ts`)
  - ✅ 단위 테스트 작성 (27개 테스트, `tests/unit/layout-loader.spec.ts`)
  - ✅ 통합 테스트 작성 (11개 테스트, `tests/unit/layout-loader-integration.spec.ts`)
  - ✅ 테스트 픽스처 생성 (`tests/fixtures/layouts/`)
  - ✅ Build 검증 완료
- Phase 2: PropsValidator 구현 — ✅ 완료 (2025-10-19)
  - React PropTypes 스타일 검증 로직
  - `isRequired`, `defaultValue`, `oneOf` 등 지원
  - Lenient/Strict 모드 처리
- Phase 3: LayoutRenderer 구현 — ✅ 완료 (2025-10-18)
  - Handlebars 템플릿 엔진 통합
  - Props 주입 및 렌더링
  - 보안 이스케이프 처리
  - XSS 방지 헬퍼 제어
  - 18개 단위 테스트 작성 및 통과
  - 보안 컨테이너 검증 로직 포함
- Phase 4: 최종 검토 — ✅ 완료 (2025-10-19)
  - ✅ 코드 리뷰 재실시 (WBS-12 Phase 4 최종 검토)
  - ⚠️ 발견 이슈: LayoutLoader 빈 YAML 처리 누락, LayoutRenderer 기본값 참조 공유, Prop 스키마 기능 불일치
  - 🔁 후속 조치 제안: LayoutLoader null 가드 추가, LayoutRenderer가 PropsValidator 재사용하도록 리팩토링, 기본값 deep copy 적용, 테스트 보강

**이슈 해결 사이클 #3 (2025-10-19):**
- **WBS-12-FIX-1**: ✅ 완료 - LayoutLoader 빈 YAML/null 가드 추가
  - 구현 내용:
    - 빈 파일 체크 추가 (content.trim().length === 0)
    - YAML 파싱 결과 null/undefined 체크 추가
    - 빈 템플릿 문자열 체크 추가 (layoutTemplate.trim().length === 0)
    - 에러 로깅 및 LayoutLoadError 명확화
  - 테스트:
    - 빈 YAML 파일 테스트 픽스처 생성 (empty.yaml, empty-template.yaml, whitespace-only.yaml)
    - 6개 새 테스트 추가 (Null and Empty YAML Handling 그룹)
    - 총 44개 테스트 (43 pass, 1 skip)
  - 파일 수정:
    - `packages/sdk/src/services/layout-loader.service.ts`: loadLayoutFile() 메서드에 null 가드 추가
    - `packages/sdk/tests/unit/layout-loader.spec.ts`: null 처리 테스트 추가
    - `packages/sdk/tests/unit/layout-loader-integration.spec.ts`: fs/js-yaml unmock 추가
  - 빌드 검증: ✅ 통과 (npm run build)
  - 테스트 검증: ✅ 통과 (43 passed, 1 skipped)

- **WBS-12-FIX-2**: ✅ 완료 - LayoutRenderer 기본값 deep copy 적용
  - 구현 내용:
    - LayoutRenderer에 `resolveProps`/`prepareRenderContext` 도입, 기본값 병합 시 깊은 복사 사용
    - `RenderOptions` 및 `mergeProps`/`cloneDeep` 헬퍼로 PropsValidator 연동 시 참조 공유 차단
    - Props 관련 타입과 `PropsValidationError` 재수출 정리로 하위 호환 유지
  - 테스트:
    - `packages/sdk/tests/unit/layout-renderer.spec.ts` 신규 작성 (기본값 독립성·불변성·중첩 deep copy 3건)
    - 기존 서비스 테스트(`tests/services/layout-renderer.spec.ts`)와 함께 26개 케이스 통과
  - 파일 수정:
    - `packages/sdk/src/services/layout-renderer.service.ts`: deep copy 병합 로직 및 옵션/헬퍼 추가
    - `packages/sdk/tests/unit/layout-renderer.spec.ts`: LayoutRenderer 기본값 deep copy 검증 테스트 추가
  - 빌드 검증: ✅ 통과 (`npm run build`)
  - 테스트 검증: ✅ 통과 (`npm run test -- layout-renderer` @ packages/sdk)

- **WBS-12-FIX-3**: ✅ 완료 - LayoutRenderer → PropsValidator 통합 리팩토링
  - 구현 내용:
    - LayoutRenderer가 PropsValidator를 의존성 주입받도록 리팩토링
    - Props 검증 로직을 PropsValidator에 완전히 위임
    - 하위 호환성 유지를 위한 에러 메시지 처리 추가
    - 중복 코드 제거 (validateType, applyDefaults 메서드 삭제)
    - 타입 import 최적화 및 내보내기 정리
  - 테스트:
    - 기존 18개 테스트 전부 통과 (하위 호환성 보장)
    - PropsValidator의 향상된 검증 기능 활용
  - 파일 수정:
    - `packages/sdk/src/services/layout-renderer.service.ts`: PropsValidator 통합, 중복 코드 제거
    - `packages/sdk/src/index.ts`: 내보내기 경로 수정
  - 빌드 검증: ✅ 통과
  - 테스트 검증: ✅ 통과 (18 passed)

- **WBS-12-FIX-4**: ✅ 완료 - LayoutRenderer 테스트 커버리지 보강
  - 구현 내용:
    - Props 스키마 누락 시나리오 테스트 추가
    - 필수 Props 누락 시나리오 테스트 추가
    - Props 타입 불일치 시나리오 테스트 추가
    - 매우 깊은 중첩 Props 테스트 (4레벨 중첩 shape)
    - PropsValidator 통합 테스트 추가 (복잡한 조합 검증)
    - Lenient/Strict 모드 동작 검증 테스트 추가
    - 에러 메시지 일관성 검증 테스트 추가
  - 테스트:
    - 5개 새로운 엣지 케이스 테스트 추가
    - 총 23개 테스트 (기존 18개 + 5개 보강)
    - PropsValidator의 고급 기능 활용 (pattern, minLength/MaxLength, arrayOf 등)
  - 파일 수정:
    - `packages/sdk/tests/services/layout-renderer.spec.ts`: 엣지 케이스 테스트 5개 추가
  - 빌드 검증: ✅ 통과
  - 테스트 검증: ✅ 통과 (23 passed, 18 → 23개로 테스트 수 증가)

**Phase 1 완료 요약 (2025-10-18):**
- **구현된 기능**:
  - `templates/agents/*.yaml` 파일 자동 로드
  - `crewx/<name>` 네임스페이스 자동 변환
  - Props 오버라이드 지원
  - Fallback 전략 (`crewx/default`)
  - Layout ID 정규화 및 검증
- **구현된 메서드**:
  - `load(layoutId, propsOverride?)`: 레이아웃 로드
  - `hasLayout(layoutId)`: 존재 여부 확인
  - `getLayoutIds()`: 레이아웃 ID 목록
  - `reload()`: 레이아웃 재로드
- **테스트**: 38개 테스트 작성 (Build 성공)

### WBS-13 CLI 레이아웃 통합 (🟡 진행중)
> 📄 상세 계획: [wbs/wbs-13-cli-layout-integration.md](wbs/wbs-13-cli-layout-integration.md)
- Phase 1: CLI 서비스 → SDK 레이아웃 스택 전환 — ✅ 완료 (2025-10-19)
  - 📄 [wbs/wbs-13-phase-1-implementation-notes.md](wbs/wbs-13-phase-1-implementation-notes.md)
  - 📄 [wbs/wbs-13-phase-1-completion-summary.md](wbs/wbs-13-phase-1-completion-summary.md)
- Phase 2: 코어 중복 로직 정리 — ✅ 완료 (2025-10-19)
- Phase 3: 통합 검증 및 회귀 테스트 — ✅ 완료 (2025-10-19)
  - 📄 [wbs/wbs-13-phase-3-test-strategy.md](wbs/wbs-13-phase-3-test-strategy.md)
  - 📄 [wbs/wbs-13-phase-3-test-cases.md](wbs/wbs-13-phase-3-test-cases.md)

**Phase 1 완료 요약 (2025-10-19):**
- **구현된 기능**:
  - CrewXTool에서 SDK LayoutLoader, LayoutRenderer 사용
  - `inline.layout` 지원 (문자열 또는 {id, props} 형식)
  - `processAgentSystemPrompt()` 헬퍼 메서드로 레이아웃 우선 처리
  - 2단계 렌더링: SDK 레이아웃 → CLI 문서 치환
  - `inline.system_prompt` fallback 유지 (backward compatibility)
- **타입 업데이트**:
  - SDK `AgentInfo.inline` 타입에 `layout`, `prompt` 필드 추가
- **중복 제거**:
  - CLI의 `mention-parser.ts` 제거 (SDK 버전 사용)
- **테스트**:
  - SDK: 240 passed (모든 테스트 통과)
  - CLI: 166 passed (decorator mock 수정 포함)
- **빌드 검증**: SDK, CLI 모두 빌드 성공

**Phase 3 완료 요약 (2025-10-19):**
- **테스트 전략 수립**:
  - 회귀 위험 분석 완료 (High/Medium/Low 분류)
  - 테스트 피라미드 설계 (Unit → Integration → Manual QA)
  - 34개 테스트 케이스 정의 (Unit: 20, Integration: 10, Manual: 4)
- **주요 검증 영역**:
  - 2단계 렌더링 파이프라인 (SDK → CLI)
  - Fallback 동작 (layout → system_prompt → systemPrompt → description)
  - 문자열/객체 형식 지원 검증
  - Backward compatibility (legacy agents)
- **발견된 잠재 이슈**:
  - ⚠️ Template path resolution 검증 필요 (root vs packages/cli)
  - 우선순위: P0 (Critical) - 다음 세션에서 확인 필요
- **산출물**:
  - 테스트 전략 문서 (34 페이지, 상세 분석)
  - 테스트 케이스 카탈로그 (P0: 18, P1: 8, P2: 7, P3: 2)

**규모 및 난이도 평가**
- Phase 분할 필요: CLI 주요 서비스와 SDK 신기능을 연결하는 작업으로 영향 범위가 넓음.
- 난이도: **중상** — Nest DI 구조, 템플릿 파이프라인, 배포 스크립트 등 여러 컴포넌트를 동시에 맞춰야 하고 회귀 위험이 높음.
