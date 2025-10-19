# WBS-16 상세 계획 — SDK Config & Skills Schema

## 개요
- **목표**: Claude `skills.md` 스펙과 CrewX YAML 설정을 SDK 레이어에서 통합적으로 파싱·검증할 수 있는 스키마를 구축한다.
- **범위**:
  - 스킬/에이전트 설정 스키마 정의 및 JSON Schema 산출
  - SDK 파서/검증기 구현 및 에러 메시지 표준화
  - CLI가 SDK 파서를 재사용하도록 리팩터링
- **완료 기준**:
  - SDK에서 `parseCrewxConfig`, `parseSkillManifest` 제공
  - VS Code용 JSON Schema/자동완성 스니펫 배포
  - CLI ConfigService/AgentLoaderService가 신규 파서를 사용하고 회귀 테스트 통과

## Phase 구성

### Phase 1 — 스키마 분석 및 설계 (예상 3일)
- Claude `skills.md` 예제 수집 및 메타데이터 필드 정리 (`name`, `description`, `visibility`, `version`, `dependencies` 등)
- CrewX `crewx.yaml` 필드 맵핑: agents, providers, layouts, documents, settings
- 스킬/에이전트 공통 타입 정의 초안 작성 (`SkillMetadata`, `CrewxProjectConfig`, `AgentDefinition`)
- JSON Schema 초안과 TypeScript 타입 선언(`packages/sdk/src/schema/types.ts`) 설계
- **산출물**: 스키마 사양 문서, 타입 다이어그램, 샘플 YAML/Markdown 세트

#### 참고 스킬 예시 (Gemini 생성)
```markdown
---
name: code-formatter
description: "Formats code snippets in various programming languages using established conventions."
version: "1.0.0"
dependencies: []
---

## Role
You are an expert code formatter. Your purpose is to take unformatted or poorly formatted code and apply consistent, readable styling based on community-accepted standards for the given language.

## Task
Your primary task is to reformat a given code snippet according to the standard style guide for its programming language. You must correctly identify the language and apply the appropriate formatting rules without altering the code's logic.

## Instructions
1. Identify Language.
2. Apply Standard Formatting (e.g., Prettier, Black, gofmt).
3. Preserve Logic.
4. Output formatted code inside a markdown code block.
```

```markdown
---
name: git-commit-generator
description: "Creates a Conventional Commits compliant commit message from a code diff."
version: "1.2.0"
dependencies:
  - code-analyzer@2.5.0
---

## Role
You are a senior software engineer with a talent for writing clear, concise, and meaningful Git commit messages.

## Task
Analyze the provided code changes and generate a Conventional Commits compliant message summarizing the change.

## Instructions
1. Analyze Diff to understand intent.
2. Determine Commit Type (`feat`, `fix`, `docs`, etc.).
3. Write imperative subject (<50 chars).
4. (Optional) Add body explaining rationale.
5. (Optional) Add footer such as `Fixes #123`.
6. Output the commit message as a single block of text.
```

### Phase 2 — SDK 파서/검증기 구현 (예상 5일)
- `packages/sdk/src/schema/` 디렉터리 생성, `config.schema.ts`, `skill.schema.ts` 추가
- `parseCrewxConfig`, `parseSkillManifest` 함수 구현: Zod 혹은 자체 검증기 활용, 에러 코드/메시지 표준화
- Progressive disclosure 대비 캐시 구조 설계 (frontmatter 우선/본문 지연 로딩)
- JSON Schema 자동 생성 파이프라인 구현 (`npm run generate:schema`)
- 단위 테스트/스냅샷 테스트 작성 (`packages/sdk/tests/schema`)
- **산출물**: 파서/스키마 코드, 자동 생성 JSON Schema, 테스트 레포트

### Phase 3 — CLI 통합 및 회귀 (예상 4일)
- ConfigService/AgentLoaderService 리팩터링: 파일 읽기 후 SDK 파서 호출로 전환
- 레거시 파서 제거 및 공통 에러 핸들링 적용
- CLI/SDK 회귀 테스트 실행, 새로운 스키마 기반 사례 추가
- 문서 업데이트 (`docs/configuration`, `CREWX.md`), 마이그레이션 가이드 초안 작성
- **산출물**: CLI 리팩터링 패치, 테스트 결과, 문서 업데이트 초안

## 리스크 및 대응
- **스킬 스펙 불확실성**: 공개 자료 부족 시 파트너십 또는 스크린샷 확보 → Phase 1에서 최소 3개의 실제 예시 확보.
- **파서 전환 회귀 위험**: feature flag 제공 (`CREWX_SCHEMA_LEGACY`)로 단계적 롤백 가능.
- **Schema 복잡도 증가**: schema 모듈 별도 디렉터리로 분리하고 변경점 자동 테스트 파이프라인 구축.

## 커뮤니케이션 & 산출물 관리
- 전담 채널 `#wbs-16-schema` 개설, 스키마 변경은 RFC 템플릿으로 공유.
- 마일스톤 종료 시 보고서: Phase 별 1페이지 요약 + 테스트 결과 첨부.
- JSON Schema/VS Code 스니펫은 `packages/docs/` 및 개발자 포털에 업로드.
