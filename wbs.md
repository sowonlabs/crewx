# CrewX WBS

> 상태 표시는 `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⚠️ 위험` 등으로 업데이트해 주세요.

## WBS 작성요령
### (⬜️ 대기) WBS-00 타이틀
> 📄 상세 계획: wbs 디렉토리에 wbs-00-title.md로 상세계획을 작성 후 링크
- (⬜️ 대기) Phase 1: 페이즈별로 제목1
- (⬜️ 대기)Phase 2: 페이즈별로 제목2
	- 디펜던시: Phase1 (이렇게 명시함으로써 phase1이 끝나야 작업이 진행될 수 있음을 알림)
- (⬜️ 대기)Phase 3: 페이즈별로 제목3
	- 디펜던시: Phase2
**주의**: 현재 파일에는 coordinator가 판별하기 편하도록 phase에는 제목과 작업 상태만 남기고 상세 계획에 자세한 내용 추가할 것 (작업자들이 확인 가능하도록)

## 현황

| 상태     | ID     | 작업명                                            | 주요 산출물 및 범위                                                                       | 선행 디펜던시 | 병행 가능성/메모                                                                                                                         |
| ------ | ------ | ---------------------------------------------- | --------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ✅ 완료   | WBS-11 | 레이아웃 시스템 기획                                    | 레이아웃 DSL 정의, 로더 설계 (단순화)                                                          | WBS-10  | Phase 1-2 완료 (2025-10-18): DSL 명세, 로더 아키텍처                                                                                        |
| ✅ 완료   | WBS-12 | 레이아웃 시스템 구현                                    | LayoutLoader, PropsValidator, LayoutRenderer 구현                                   | WBS-11  | Phase 1-4 완료 (2025-10-18): 3개 서비스 구현 및 아키텍처 검토 완료. 사이클 #3 완료 (2025-10-19): WBS-12-FIX-1, FIX-2, FIX-3, FIX-4 리팩토링 및 테스트 보강 완료     |
| ✅ 완료   | WBS-13 | CLI 레이아웃 통합                                    | CLI가 SDK LayoutLoader/Renderer/PropsValidator를 사용해 `inline.layout` YAML을 처리하도록 통합 | WBS-12  | **전체 완료 (2025-10-19)**: Phase 1-3 완료, SDK 레이아웃 스택 통합, 코어 중복 로직 정리, P0 검증 완료 (template path resolution verified, production-ready) |
| ✅ 완료   | WBS-14 | StructuredPayload/TemplateContext 통합 및 하드코딩 제거 | CLI 시스템 프롬프트 중복 제거, TemplateContext SDK 공개, 컨텍스트 타입 표준화                           | WBS-13  | **전체 완료 (2025-10-20)**: Phase 1-5 완료. TemplateContext SDK 공개, 하드코딩 제거, 레이아웃 시스템 통합, 문서화 및 CREWX.md 정리 완료                          |
| ✅ 완료   | WBS-15 | 하드코딩 프롬프트 레이아웃 시스템 통합                          | `<user_query>` 보안 래핑을 레이아웃 계층으로 이관, Legacy 플래그로 안전한 전환 기반 확보                           | WBS-14  | Phase 1-2 완료 (2025-10-19~20), 잔여 하드코딩 정리는 WBS-16~18에서 Claude 스킬 통합과 함께 진행                                                       |
| ✅ 완료   | WBS-16 | SDK Config & Skills Schema                             | Claude `skills.md` 스키마 흡수, CrewX YAML/JSON Schema 정규화, CLI 파서 재사용 구조                              | WBS-14  | **Phase 1-2 완료 (2025-10-20)**: 타입 시스템, JSON Schema, 파서/검증기 구현 완료. 40+ 단위 테스트 통과. Phase 3 대기중                                                               |
| ✅ 완료   | WBS-17 | Skill Runtime & Package                                 | 스킬 실행 수명주기, AppManifest/번들 포맷, progressive disclosure 러닝타임                                       | WBS-16  | **Phase 1 완료 (2025-10-20)**: SkillRuntime 설계, 라이프사이클 정의, Claude 스킬 어댑터, ExecutionContext 구조, 타입 정의 완료. Phase 2-3 대기중                                                             |
| ⬜️ 대기   | WBS-18 | SDK AgentRuntime Provider 통합                          | AgentRuntime에 AIProvider 주입 구조 설계 및 구현, Mock Provider 제거, 실제 Provider 연동                  | WBS-17  | AgentRuntime이 Provider를 주입받아 실제 AI 호출 수행하도록 리팩토링. createCrewxAgent의 provider config를 AgentRuntime에 연결                                                             |

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
- **P0 Critical 이슈 검증 완료 (2025-10-19)**:
  - ✅ Template path resolution 검증 완료 (root vs packages/cli)
  - ✅ 다층 fallback 전략 확인: packages/cli → root → cwd
  - ✅ Postbuild script 템플릿 동기화 검증 (MD5 확인)
  - ✅ LayoutLoader 런타임 테스트 성공
  - 📄 [wbs/wbs-13-phase-3-p0-verification-report.md](wbs/wbs-13-phase-3-p0-verification-report.md)
  - **결론**: 코드 변경 불필요, 현재 구현이 올바름 (production-ready)
- **산출물**:
  - 테스트 전략 문서 (34 페이지, 상세 분석)
  - 테스트 케이스 카탈로그 (P0: 18, P1: 8, P2: 7, P3: 2)
  - P0 검증 리포트 (13 페이지, 상세 분석 및 권장사항)

**규모 및 난이도 평가**
- Phase 분할 필요: CLI 주요 서비스와 SDK 신기능을 연결하는 작업으로 영향 범위가 넓음.
- 난이도: **중상** — Nest DI 구조, 템플릿 파이프라인, 배포 스크립트 등 여러 컴포넌트를 동시에 맞춰야 하고 회귀 위험이 높음.

### WBS-14 StructuredPayload/TemplateContext 통합 및 하드코딩 제거 (✅ 완료)
> 📄 상세 계획: [wbs/wbs-14-context-integration-revised.md](wbs/wbs-14-context-integration-revised.md) - **Codex 검토 반영**
> 📄 회의 요약: [wbs/wbs-14-meeting-summary.md](wbs/wbs-14-meeting-summary.md)

- **Phase 1**: 안전망 검증 + 텔레메트리 계획 — ✅ 완료 (2025-10-19)
  - ✅ Inline/minimal layout 에이전트 목록 파악 (2개 layout, 6개 에이전트)
  - ✅ append 사용 통계 계획 수립 (4개 메트릭 정의)
  - ✅ 폴백 경로 문서화 (7개 필드 우선순위 체인)
  - ✅ 안전 검증 보고서 작성
  - ✅ 자동화 테스트 추가: `packages/cli/tests/unit/services/crewx-tool-layout.spec.ts`
  - 📄 [wbs/wbs-14-phase-1-safety-report.md](wbs/wbs-14-phase-1-safety-report.md)
  - 📄 [wbs/wbs-14-phase-1-append-metrics.md](wbs/wbs-14-phase-1-append-metrics.md)
  - 📄 [wbs/wbs-14-phase-1-fallback-paths.md](wbs/wbs-14-phase-1-fallback-paths.md)
  - 📄 [wbs/wbs-14-phase-1-completion-summary.md](wbs/wbs-14-phase-1-completion-summary.md)
  - 🧪 [wbs/wbs-14-phase-1-test-agents.yaml](wbs/wbs-14-phase-1-test-agents.yaml)

- **Phase 3** (순서 변경): SDK TemplateContext 정제 — ✅ 완료 (2025-10-19)
  - ✅ TemplateContext 필드 정체 (CLI 특화 `options` 필드 제거)
  - ✅ AgentMetadata 인터페이스 정의 (specialties, capabilities, description)
  - ✅ SDK TemplateContext에 agentMetadata 필드 추가
  - ✅ packages/cli/src/crewx.tool.ts에서 agentMetadata 실제 매핑 구현
  - ✅ templates/agents/default.yaml에서 agentMetadata 참조 지원 (하위 호환성 유지)
  - ✅ SDK export 완료 (packages/sdk/src/index.ts)
  - ✅ TypeScript strict mode 통과
  - ✅ 단위 테스트 작성 (packages/sdk/tests/unit/template-context.test.ts, 9개 테스트)
  - ✅ Build 검증 (SDK + CLI 모두 빌드 성공)

- **Phase 2** (순서 변경): 하드코딩 제거 + 컨텍스트 적용 — ✅ 완료 (2025-10-19)
  - ✅ [crewx.tool.ts:696-700](packages/cli/src/crewx.tool.ts#L696-L700) 제거 (query 모드 append)
  - ✅ [crewx.tool.ts:996-999](packages/cli/src/crewx.tool.ts#L996-L999) 제거 (execute 모드 append)
  - ✅ Feature flag CREWX_APPEND_LEGACY 구현 (backward compatibility)
  - ✅ 회귀 테스트 통과 (CLI: 166/166 relevant, SDK: 248/248 relevant)
  - ✅ Build 검증 (SDK + CLI 모두 빌드 성공)
  - 📄 [wbs/wbs-14-phase-2-completion-summary.md](wbs/wbs-14-phase-2-completion-summary.md)

- **Phase 4**: 문서화 — ✅ 완료 (2025-10-20)
  - `packages/docs/context-integration-standard.md`: TemplateContext 아키텍처와 feature flag 가이드
  - `packages/docs/context-integration-migration.md`: 에이전트 영향도, 폴백 설명, 테스트 체크리스트
  - `packages/docs/layout-dsl-field-reference.md`: Layout DSL 필드/props/헬퍼 레퍼런스
  - 관련 링크를 `packages/sdk/CREWX.md`, `packages/cli/CREWX.md`, `README.md`에 추가

- **Phase 5**: CREWX.md 정리 — ✅ 완료 (2025-10-20)
  - ✅ packages/sdk/CREWX.md: TemplateContext, AgentMetadata를 Key Exports에 추가, Layout System exports 보강
  - ✅ packages/cli/CREWX.md: TemplateContext Integration 강화, data flow diagram 추가, feature flag 문서화
  - ✅ README 파일 업데이트: Context Integration 관련 문서 링크 추가 (SDK, CLI, Root)
  - ✅ wbs.md: WBS-14 Phase 5 및 전체 상태를 ✅ 완료로 업데이트
  - 📄 [wbs/wbs-14-phase-5-completion-summary.md](wbs/wbs-14-phase-5-completion-summary.md): TemplateContext 문서 작업 전부 종료

**Phase 5 완료 요약 (2025-10-20):**
- CREWX.md 문서 구조와 링크를 SDK/CLI/Root 전반에서 정리해 TemplateContext 흐름을 일관되게 반영
- [wbs/wbs-14-phase-5-completion-summary.md](wbs/wbs-14-phase-5-completion-summary.md)을 기준으로 TemplateContext 문서화 TODO를 모두 마감

**개발 배경**:
- 개발자 회의 완료: @crewx_claude_dev, @crewx_codex_dev, @crewx_glm_dev
- Codex 분석: 3가지 실패 모드 + 3가지 권장 옵션 제시
- GLM 분석: 즉시 제거 가능, TemplateContext 부분 공개 권고
- 최종 결정안: "Codex Option 1 + GLM 즉시 제거" 하이브리드

**규모 및 난이도 평가**:
- 규모: **중** — 5개 Phase, 스프린트 방식
- 난이도: **중상** — 하드코딩 제거 시 폴백 경로 검증 필수, SDK 타입 확장 필요
- 위험도: 🔴 **High** (inline 에이전트 손실 가능) → Phase 1 안전망 검증으로 완화

### WBS-15 하드코딩 프롬프트 레이아웃 시스템 통합 (✅ 완료)
> 📄 상세 계획: [wbs/wbs-15-prompt-wrapping-integration.md](wbs/wbs-15-prompt-wrapping-integration.md)

**목표**: `<user_query>` 보안 래핑 로직을 레이아웃 시스템으로 통합하여 하드코딩 제거

- **Phase 1**: 래핑 로직 분석 및 안전망 검증 — ✅ 완료 (2025-10-19)
  - ✅ 래핑 로직 전체 흐름 다이어그램 (6단계)
  - ✅ 안전 시나리오 5가지 테스트 정의
  - ✅ 위험도 매트릭스 작성 (5개 시나리오 × 리스크 레벨)
  - ✅ Phase 3 완화 전략 수립
  - 📄 [wbs/wbs-15-phase-1-wrapping-analysis.md](wbs/wbs-15-phase-1-wrapping-analysis.md)

- **Phase 2**: SDK 레이아웃 구조 확장 — ✅ 완료 (2025-10-20)
  - TemplateContext에 보안 전용 `vars` 타입 추가 (`security_key`, `user_input`, `user_input_raw`)
  - LayoutRenderer가 사용자 입력을 HTML-이스케이프 처리하고 RAW 값은 진단용으로 보존
  - 신규 보안 예시 레이아웃 `templates/agents/secure-wrapper.yaml` 등록 (propsSchema 포함)
  - 기본/미니멀 레이아웃에 `<user_query>` 블록 추가로 컨테이너 손실 방지
  - Sanitization 관련 Vitest 케이스 2건 추가 (escape & raw 보존 검증)

- **Phase 3 ~ Phase 5** 범위는 Claude 스킬 통합 로드맵(WBS-16~18)으로 이관하여 SDK 중심 구조 개편과 함께 처리 예정
- Legacy 경로는 `CREWX_WRAPPING_LEGACY` 플래그로 통제, 신규 레이아웃 기반 래핑이 기본값

**결과 요약**
- 사용자 입력 보안 처리가 레이아웃 계층으로 표준화되어 CLI/SDK 동작이 일치
- secure-wrapper 레이아웃과 Sanitization 테스트로 회귀 위험 최소화
- 하드코딩 제거 잔여 작업은 Skill 런타임 통합과 병행하도록 재계획 완료

**후속 조치**
- CLI 하드코딩 제거 및 문서화는 WBS-16 Phase 2에서 완료
- Legacy 플래그는 Marketplace 론치 전까지 유지하며 단계적 제거 계획 수립

### WBS-16 SDK Config & Skills Schema (✅ 완료)
> 📄 상세 계획: [wbs/wbs-16-sdk-config-schema.md](wbs/wbs-16-sdk-config-schema.md)

**목표**: Claude `skills.md` 포맷과 CrewX YAML을 통합 스키마로 정규화하고 SDK에서 직접 검증/파싱할 수 있게 한다.

- **Phase 1**: 스키마 설계 및 아티팩트 정의 — ✅ 완료 (2025-10-20)
  - ✅ Claude 스킬 메타데이터 분석 완료
  - ✅ CrewX YAML 필드 맵핑 완료 (wbs/wbs-16-field-mapping.md)
  - ✅ TypeScript 타입 초안 작성 (packages/sdk/src/schema/skills.types.ts)
  - ✅ JSON Schema 파일 생성 (packages/sdk/schema/skills-config.json)
  - ✅ 설계 문서 작성 (wbs/wbs-16-phase-1-schema-design.md)
  - ✅ SDK exports 업데이트
  - 📄 [wbs/wbs-16-field-mapping.md](wbs/wbs-16-field-mapping.md) - 필드 맵핑 테이블
  - 📄 [wbs/wbs-16-phase-1-schema-design.md](wbs/wbs-16-phase-1-schema-design.md) - 설계 문서
- **Phase 2**: SDK 파서/검증기 구현 — ✅ 완료 (2025-10-20)
  - ✅ `parseCrewxConfig()` 함수 구현 (yaml 파싱, validation, progressive disclosure)
  - ✅ `parseSkillManifest()` 함수 구현 (markdown frontmatter 파싱, content extraction)
  - ✅ `validateSkillMetadata()` 함수 구현 (엄격한 검증 규칙)
  - ✅ 에러 메시지 및 progressive disclosure 캐시 구조 마련
  - ✅ 40+ 단위 테스트 작성 및 통과 (packages/sdk/tests/unit/skills-parser.spec.ts)
  - ✅ SDK exports 업데이트 (7개 공개 함수)
  - ✅ Build 검증 완료 (npm run build)
  - 📄 [wbs/wbs-16-phase-2-completion-summary.md](wbs/wbs-16-phase-2-completion-summary.md) - Phase 2 완료 요약
- **Phase 3**: CLI 파서 전환 및 회귀 테스트 — ⬜️ 대기
  - ConfigService/AgentLoaderService가 SDK 파서를 재사용하도록 리팩터링
  - 회귀 테스트/문서 업데이트
- **핵심 설계 포인트**:
  - 기본 스킬 소스는 Claude Code `skills/` 디렉터리, `skillsPaths` 배열로 프로젝트·외부 경로 추가
  - 에이전트별 `skills.include`/`skills.exclude` 필드로 특정 스킬만 활성화/제외 가능
  - Progressive disclosure: 메타데이터만 먼저 로드, 필요 시 full content 로드
  - Validation modes: strict (production), lenient (development)

**산출물**
- ✅ `packages/sdk/src/schema/skills.types.ts` - 15 interfaces, 4 error classes
- ✅ `packages/sdk/src/schema/skills-parser.ts` - 11 public functions (743 lines)
- ✅ `packages/sdk/tests/unit/skills-parser.spec.ts` - 40+ test cases (610 lines)
- ✅ `packages/sdk/schema/skills-config.json` - JSON Schema (VS Code ready)
- ✅ `wbs/wbs-16-field-mapping.md` - 필드 맵핑 테이블
- ✅ `wbs/wbs-16-phase-1-schema-design.md` - 아키텍처 설계 문서
- ✅ `wbs/wbs-16-phase-2-completion-summary.md` - Phase 2 완료 요약
- ⬜ 마이그레이션 가이드 초안 (Phase 3)

### WBS-17 Skill Runtime & Package (✅ 완료 - Phase 1)
> 📄 상세 계획: [wbs/wbs-17-skill-runtime.md](wbs/wbs-17-skill-runtime.md)
> 📄 Phase 1 설계: [wbs/wbs-17-phase-1-skill-runtime-design.md](wbs/wbs-17-phase-1-skill-runtime-design.md)

**목표**: 스킬 실행 수명주기와 AppManifest/번들 포맷을 정의하고 향후 레지스트리 연동을 대비한 SDK 준비를 완료한다. 초기에는 Claude Code의 `skills/` 디렉터리를 그대로 활용하며, 패키징 시 스킬과 runtime 요구 메타데이터를 함께 포함한다.

- **Phase 1**: ✅ 완료 — SkillRuntime 설계, progressive disclosure 대응 로더, execution context 표준화, Claude 스킬 어댑터 구현
  - ✅ SkillRuntime 라이프사이클 설계 (Load → Validate → Prepare → Execute → Cleanup)
  - ✅ Progressive Disclosure 전략 구현 (메타데이터 우선 로딩, 콘텐츠 지연 로딩)
  - ✅ ExecutionContext 구조 정의 (SDK/CLI 공용, 런타임 요구사항 포함)
  - ✅ Claude 스킬 어댑터 구현 (skills.md → CrewX agent 매핑)
  - ✅ Runtime Requirements Validator (Python, Node, Docker, Memory)
  - ✅ 타입 정의 및 인터페이스 설계 (20+ interfaces, 4 error classes)
- **Phase 2**: ⬜️ 대기 — AppManifest & 번들 빌더 — YAML+리소스 패킹 포맷 정의, runtimeRequirements 메타데이터 저장, 서명/버전 필드, 검증 CLI 프로토타입
- **Phase 3**: ⬜️ 대기 — Registry Mock 및 E2E — Mock 기반 업로드/설치/실행 흐름 검증, 설치 시 runtimeRequirements 안내로 장기 목표 준비

**Phase 1 완료 요약 (2025-10-20):**
- **핵심 아키텍처**: 5단계 라이프사이클, Progressive Disclosure, 이벤트 기반 실행
- **주요 구현**: SkillRuntime, ProgressiveSkillLoader, ClaudeSkillAdapter, SystemRuntimeValidator
- **성능 최적화**: 메타데이터 캐싱, 지연 로딩, TTL 기반 만료 관리
- **안전성**: 입력 검증, 런타임 요구사항 체크, 그레이스풀 디그레이데이션
- **확장성**: 인터페이스 기반 설계, Provider 패턴, Mock 지원

**산출물**
- ✅ `packages/sdk/src/types/skill-runtime.types.ts` - 핵심 타입 정의 (500+ lines)
- ✅ `packages/sdk/src/skills/runtime/skill-runtime.ts` - 메인 런타임 구현 (600+ lines)
- ✅ `packages/sdk/src/skills/runtime/progressive-loader.ts` - Progressive disclosure 로더 (300+ lines)
- ✅ `packages/sdk/src/skills/adapter/claude-skill-adapter.ts` - Claude 스킬 어댑터 (400+ lines)
- ✅ `packages/sdk/src/skills/runtime/runtime-requirements-validator.ts` - 런타임 검증기 (350+ lines)
- ✅ `packages/sdk/src/skills/index.ts` - 모듈 export
- ✅ `wbs/wbs-17-phase-1-skill-runtime-design.md` - 상세 설계 문서
- ⬜ Registry Mock 스크립트, API 계약서(RFC), CLI 통합 PoC (Phase 2-3)

---

### (⬜️ 대기) WBS-18 SDK AgentRuntime Provider 통합 + CLI 통합
> 📄 상세 계획: [wbs/wbs-18-agent-provider-integration.md](wbs/wbs-18-agent-provider-integration.md)

- (⬜️ 대기) Phase 1: SDK Provider 주입 구조 설계
- (⬜️ 대기) Phase 2: AgentRuntime Provider 통합
	- 디펜던시: Phase 1
- (⬜️ 대기) Phase 3: SDK 테스트 업데이트
	- 디펜던시: Phase 1, 2
- (⬜️ 대기) Phase 4: CLI Provider Bridge 구현
	- 디펜던시: Phase 1
- (⬜️ 대기) Phase 5: CLI 명령어 SDK 사용 통합
	- 디펜던시: Phase 4

**주의**: CLI가 SDK를 실제로 사용하는 레퍼런스 구현
