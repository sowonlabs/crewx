# CrewX WBS

> 상태: `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⏸️ 보류`

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [진행 현황](#진행-현황)
3. [WBS-19: API Provider 설계](#wbs-19-api-provider-설계-및-기획--완료)
4. [WBS-20: Mastra 통합](#wbs-20-mastra-통합-구현--완료)
5. [WBS-21: Tool Calling 구현](#wbs-21-tool-calling-구현--진행중)
6. [WBS-23: YAML 파싱](#wbs-23-yaml-파싱-및-agent-생성--완료)
7. [WBS-24: CLI 통합](#wbs-24-cli-통합--완료)
8. [WBS-26: 문서화](#wbs-26-문서화-및-예제--완료)
9. [WBS-28: Provider 스펙 설계](#wbs-28-provider-스펙-호환성-설계--진행중)
10. [WBS-27: Coordinator Loop](#wbs-27-coordinator-loop-개선--보류)
11. [WBS-29: Slack Bot Network Isolation](#wbs-29-slack-bot-network-isolation-문제--대기)
12. [WBS-30: Marketplace MVP](#wbs-30-marketplace-mvp--대기)
13. [WBS-32: Project Templates](#wbs-32-project-templates-create--대기)
14. [WBS-33: Template 서브커맨드 개선](#wbs-33-template-서브커맨드-개선--대기)
15. [WBS-34: Dynamic Tool Selection](#wbs-34-dynamic-tool-selection-동적-도구-선택--진행중)
16. [WBS-35: Slack File Download](#wbs-35-slack-file-download-슬랙-파일-다운로드--대기)
17. [참고 문서](#참고-문서)

---

## 프로젝트 개요

**목표**: API Provider 구현으로 LiteLLM 게이트웨이 지원 및 Tool Calling 통합

**배경**:
- 기존: CLI Provider (spawn 기반)
- 신규: API Provider (HTTP + Tool Calling)

**기술 스택**: Vercel AI SDK, Mastra, Zod

**총 소요**: ~~3-4주~~ → **1.5-2주** (Mastra 통합으로 50% 단축)

---

## 진행 현황

| 상태  | ID         | 작업명                         | 산출물                 | 소요       | 우선순위   |
| --- | ---------- | --------------------------- | ------------------- | -------- | ------ |
| ✅   | WBS-19     | API Provider 설계             | 아키텍처, YAML 스펙       | 2-3일     | P0     |
| ✅   | WBS-20     | Mastra 통합                   | 7 Providers 구현      | 3일       | P0     |
| ✅   | **WBS-21** | **Tool Calling 구현**         | **Built-in Tools**  | **2-3일** | **P0** |
| ✅   | ~~WBS-22~~ | ~~MCP 통합~~                  | ~~Mastra 제공~~       | 0일       | -      |
| ✅   | WBS-23     | YAML 파싱                     | Provider Factory    | 2-3일     | P0     |
| ✅   | WBS-24     | CLI 통합                      | CLI 명령어 지원          | 1-2일     | P0     |
| ✅   | WBS-26     | 문서화                         | 가이드, 예제             | 2-3일     | P1     |
| ✅   | WBS-28     | Provider 스펙 설계              | options 통합          | 3-4일     | P0     |
| ⏸️  | WBS-27     | Coordinator Loop            | 로그 기반 추적 (보류)       | 3-5일     | P2     |
| ⏸️  | WBS-29     | Slack Bot Network Isolation | Codex 네트워크 제한 해결    | 1-2일     | P2     |
| ⏸️  | WBS-25     | 고급 기능                       | Streaming, Cost     | 3일       | P2     |
| ⏸️  | WBS-30     | Marketplace MVP (전략)        | 비즈니스 모델 설계          | 완료       | P2     |
| ⏸️  | WBS-31     | Marketplace 구현 (Phase 1)    | 실제 웹사이트 구축          | 4일       | P2     |
| ✅   | WBS-32     | Project Templates (create)  | crewx template 스캐폴딩 | ~2h      | P0     |
| ✅   | WBS-33     | Template 서브커맨드 개선 | 파일 보호 + 동적 리스트 | 2-3h     | P2     |
| ⏸️  | WBS-34     | Dynamic Tool Selection | vars 기반 동적 도구 선택 (Phase 2 완료) | 3-4h     | P2     |
| ✅   | WBS-35     | Slack File Download | 슬랙 파일 다운로드 (Phase 1-5 완료) | ~57분   | P2     |

---

## WBS-19: API Provider 설계 및 기획 (✅ 완료)
> 📄 [wbs/wbs-19-design-document.md](wbs/wbs-19-design-document.md)

**산출물**:
- 아키텍처 다이어그램
- YAML 스펙 정의
- TypeScript 타입 시스템
- Mastra 통합 전략

---

## WBS-20: Mastra 통합 구현 (✅ 완료)
> 📄 [wbs/wbs-20-mastra-integration.md](wbs/wbs-20-mastra-integration.md)

**산출물**:
- MastraAPIProvider 구현
- MastraToolAdapter
- 7 Providers 지원 (OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI)
- 36개 E2E 테스트 통과

---

## WBS-21: Tool Calling 구현 (✅ 완료)

**목표**: Gemini CLI의 Built-in Tools를 CrewX API Provider로 이식

**현재 상태**: All phases completed ✅ (2025-01-13)

### 🔧 중요 해결: OpenRouter Tool Calling 이슈

**문제**: OpenRouter 사용 시 tool calling 동작 안함
- `createOpenAI()` + baseURL로 OpenRouter 연결 시 tool 무시
- `tool_choice: "required"` 전달해도 효과 없음

**해결**: `@openrouter/ai-sdk-provider` 전용 SDK 사용
- MastraAPIProvider가 URL에서 `openrouter.ai` 감지 시 자동으로 OpenRouter SDK 사용
- 패키지 추가: `@openrouter/ai-sdk-provider`
- 검증: `gpt-4o-mini`, `gpt-oss-20b` 모두 tool calling 성공

**관련**: WBS-28 (Provider Options 설계 문서에 상세 기록)

### Phase 1: read_file Tool 이식 (✅ 완료)

**발견된 문제**: Mastra `createTool()` 형식 필요

**해결 완료**:
- ✅ read-file.tool.ts를 Mastra `createTool()` 형식으로 수정
- ✅ Execute signature 수정: `async ({ context }) => { const { file_path, offset, limit } = context; }`
- ✅ ai-provider.service.ts 타입 수정 (any[] 허용)
- ✅ MastraAPIProvider.setTools() 타입 업데이트
- ✅ TypeScript 빌드 통과 확인

**주요 변경사항**:
1. Tool 정의: `createTool({ id, inputSchema, outputSchema, execute })` 사용
2. 필드명: `name` → `id`, `parameters` → `inputSchema`
3. Execute signature: `async ({ context }) => { const { args } = context; }`
4. Type system: `FrameworkToolDefinition | Mastra Tool` 모두 허용

**완료 커밋**: dac8ec6

**다음 단계**: Management approval for next features (WBS-25, WBS-28)

**참고**:
- Mastra 공식 문서: https://mastra.ai/reference/tools/create-tool
- Mastra ToolExecutionContext: https://mastra.ai/en/docs/tools-mcp/dynamic-context

### Phase 2: 추가 Tools 이식 (✅ 완료)
- [x] replace (edit) tool
- [x] run_shell_command tool
- [x] ls (list_directory) tool
- [x] write_file tool
- [x] grep (search) tool

### Phase 3: Built-in Tools 통합 (✅ 완료)
- [x] 6개 built-in tools 로딩 (read_file, write_file, replace, ls, grep, run_shell_command)
- [x] Tool export 및 integration
- [x] 빌드 및 검증

**Note**: MCP server integration은 Mastra instance level에서 처리됨. 현재는 built-in tools만 API Provider에서 사용 가능.

---

## WBS-23: YAML 파싱 및 Agent 생성 (✅ 완료)
> 📄 [wbs/wbs-23-yaml-parsing-agent-factory.md](wbs/wbs-23-yaml-parsing-agent-factory.md)

**산출물**:
- YAML 파서 (420+ lines)
- Provider Factory 통합
- 36개 단위 테스트 통과

---

## WBS-24: CLI 통합 (✅ 완료)
> 📄 [wbs/wbs-24-cli-integration.md](wbs/wbs-24-cli-integration.md)

**산출물**:
- `crewx q`, `crewx execute`, `crewx chat` 지원
- `crewx doctor` API provider 체크
- 13개 통합 테스트

---

## WBS-26: 문서화 및 예제 (✅ 완료)
> 📄 [wbs/wbs-26-documentation-examples.md](wbs/wbs-26-documentation-examples.md)

**산출물**:
- API Reference (30+ 페이지)
- 사용 가이드 (40+ 페이지)
- 마이그레이션 가이드 (30+ 페이지)
- 3개 예제 (basic, tools, mcp)

---

## WBS-28: Provider 스펙 호환성 설계 (✅ 완료)
> 📄 [wbs/wbs-28-provider-options-design.md](wbs/wbs-28-provider-options-design.md)

**목표**: CLI/API Provider options 스펙 통합 및 Tool 권한 제어

**현재 상태**: 전체 Phase 완료 (설계, 타입, 구현, 테스트, 문서화)

### Phase 1: 설계 (✅ 완료)
- ✅ 문제 정의
- ✅ 3가지 방안 도출
- ✅ **의사결정 완료: 방안 2 선택**
  - `options.query/execute` 객체 확장
  - 레거시 배열 지원
  - 기본값: 빈 배열 (안전 우선)

### 최종 스펙

```yaml
# API Provider (신규)
agents:
  - name: claude_api
    provider: api/anthropic
    options:
      query:                     # CLI와 키 이름 동일
        tools: [file_read, grep]
        mcp: [filesystem]
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem, git]

# 레거시 지원
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]  # 자동 변환: options.execute로
```

### Phase 2: 타입 구현 (✅ 완료)
- ✅ TypeScript 타입 (Discriminated Union)
- ✅ Zod 스키마
- ✅ JSON Schema

### Phase 3: Provider 구현 (✅ 완료)
- ✅ MastraAPIProvider 수정
- ✅ normalizeAPIProviderConfig 함수
- ✅ 모드별 필터링 로직

### Phase 4: 테스트 (✅ 완료)
- ✅ 단위 테스트 (106 tests - 목표 15+ 초과 달성)
  - api-provider-types.spec.ts: 33 tests (타입 가드, 레거시 감지, 변환)
  - api-provider-schema.spec.ts: 33 tests (Zod 스키마 검증)
  - api-provider-normalizer.spec.ts: 28 tests (정규화, 모드 필터링)
- ✅ 통합 테스트 (api-provider-integration.spec.ts: 12 tests)
- ✅ 레거시 변환 테스트
- ✅ 엣지 케이스 및 에러 처리

### Phase 5: 문서화 (✅ 완료)
- ✅ API Provider 가이드 업데이트 (Provider Options 섹션)
- ✅ 마이그레이션 가이드 (tools/mcp 필드 변환 예제)
- ✅ 예제 추가 (api-provider-with-tools.yaml, api-provider-with-mcp.yaml, api-provider-modes.yaml)

---

## WBS-27: Coordinator Loop 개선 (⏸️ 보류)

**목표**: Worker Agent 로그 분석을 통한 작업 완료 자동 감지

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**핵심 아이디어**:
- Coordinator가 Worker Agent 로그 분석
- wbs.md 자동 업데이트 (Self-Healing)
- 5분마다 체크 (비용 무료)

---

## WBS-29: Slack Bot Network Isolation 문제 (⏸️ 보류)
> 📄 [wbs/wbs-29-slack-network-isolation.md](wbs/wbs-29-slack-network-isolation.md)

**목표**: Slack Bot에서 실행되는 Codex Provider의 네트워크 접근 제한 해결

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**산출물**:
- 네트워크 환경 분석 보고서
- 해결 방안 구현
- Slack Bot 배포 가이드

---

## WBS-30: Marketplace MVP - 전략 문서 (⏸️ 보류)
> 📄 [wbs/wbs-30-marketplace-mvp.md](wbs/wbs-30-marketplace-mvp.md)

**목표**: 마켓플레이스 비즈니스 모델 및 전략 수립

**상태**: 🔄 보류 (전략 완료됨, 구현은 WBS-32 이후 재검토)

**핵심 전략**:
- 3-Tier 모델 (무료/유료/엔터프라이즈)
- IP 보호 (AES-256 암호화 + 라이선스 검증)
- 로깅 시스템 (3-level: Public/Developer/Protected)

**아키텍처**: Registry(JSON) + Git Storage + Astro Frontend

**산출물**:
- ✅ 비즈니스 모델 설계
- ✅ 기술 스택 결정 (Astro + Prisma + NestJS)
- ✅ 3-Phase 로드맵
- ✅ 비용 구조 분석

**기술적 실현 가능성**: ✅ 100% 가능 (난이도: 중)

**상태**: 전략 승인 완료, WBS-31로 구현 진행

---

## WBS-31: Marketplace 구현 (Phase 1 - MVP) (⏸️ 보류)
> 📄 [wbs/wbs-31-marketplace-implementation.md](wbs/wbs-31-marketplace-implementation.md)

**목표**: 투자자 데모용 실제 웹사이트 구축 (3일, 30분 단위 작업)

**상태**: 🔄 보류 (WBS-32 완료 후 재검토 예정)

**⚠️ MVP 전용**: 프로덕션은 Phase 2에서 재구축 예정

**기술 스택** (⚠️ MVP 전용):
- **Framework**: Astro 4.x 하이브리드 (정적 + SSR + Serverless)
- **Database**: Prisma 5.x + PostgreSQL (Supabase)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (완전 무료)

**프로젝트 구조** (단일 프로젝트):
```
crewx-marketplace/
├── prisma/         # DB 스키마 + Seed
├── src/
│   ├── pages/      # Astro 페이지 (정적 + SSR)
│   │   └── api/    # Serverless Functions
│   ├── components/ # UI 컴포넌트
│   └── lib/        # Prisma Client
└── public/
```

**구현 계획** (30분 단위):
- **Day 1**: Astro + Prisma + Supabase 세팅 (3.5h)
- **Day 2**: 데이터 + UI (API Routes + 홈/상세 페이지) (3.5h)
- **Day 3**: 검색 + Vercel 배포 + 데모 준비 (3h)

**산출물**:
- ✅ crewx-marketplace Git 프로젝트
- ✅ 작동하는 웹사이트 (marketplace.crewx.dev)
- ✅ 투자자 데모 스크립트
- ✅ 10개 샘플 Agent 데이터

**Phase 1 MVP 범위**:
```
포함:
✅ Agent 목록/상세 페이지
✅ 검색/필터 기능
✅ CLI 설치 명령어 복사
✅ 정적 배포

제외 (Phase 2+):
❌ 암호화/라이선스
❌ 결제 시스템
❌ 리뷰/레이팅
```

**다음 단계**: WBS-31 착수 승인 대기

---

## WBS-32: Project Templates (crewx template) (✅ 완료)
> 📄 [wbs/wbs-32-project-templates.md](wbs/wbs-32-project-templates.md)

**목표**: `crewx template` 서브커맨드 기반 Git 템플릿 다운로드 시스템 (MVP)

**실제 소요**: ~2시간 (AI 작업 기준, Phase 3 MVP만)

**작업 이력**:
- **1차 시도**: 2025-11-18 12:00 ~ 2025-11-18 14:00 (~2h) - ❌ 리젝 (설계 변경 - Git 기반 템플릿으로 재설계)
- **2차 시도 (Phase 3)**: 2025-11-18 16:00 ~ 2025-11-18 16:10 (~10분) - ✅ 완료

**구현된 기능**:
- ✅ `crewx template init <template-name>` - Git에서 템플릿 다운로드
- ✅ `crewx template list` - 사용 가능한 템플릿 목록
- ✅ `crewx template show <template-name>` - 템플릿 상세 정보
- ✅ 환경변수 지원: `CREWX_TEMPLATE_REPO` - 회사 템플릿 저장소 사용
- ✅ giget 통합 - Git CLI 불필요, GitHub tarball API 사용
- ✅ 현재 디렉토리에 템플릿 파일 생성
- ✅ 명확한 에러 처리 및 메시지

**Phase 진행 상황**:
- [❌] Phase 1: CLI 명령어 구조 (4-5시간) - ❌ 리젝 (1차 시도)
- [❌] Phase 2: 현재 디렉토리 템플릿 init (3-4시간) - ❌ 리젝 (1차 시도, 설계 변경)
- [✅] Phase 3: Git 템플릿 다운로드 (2시간) - ✅ 완료 (~10분)
- [✅] Phase 4: 템플릿 저장소 구성 (1-1.5시간) - ✅ 완료 - 담당: crewx_claude_dev
- [✅] Phase 5: 문서화 (30분) - ✅ 완료 (docs/project-templates.md)

**작업 시간 추적**:
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | - | 2025-11-18 12:00 | 2025-11-18 14:00 | ~2h | 4-5h | ❌ 리젝 |
| Phase 2 | - | 2025-11-18 12:00 | 2025-11-18 14:00 | ~2h | 3-4h | ❌ 리젝 |
| Phase 3 | crewx_claude_dev | 2025-11-18 16:00 | 2025-11-18 16:10 | ~10분 | 2h | ✅ 완료 |
| Phase 4 | crewx_claude_dev | 2025-11-18 19:53 | 2025-11-18 19:58 | ~5분 | 1-1.5h | ✅ 완료 |
| Phase 5 | crewx_dev_lead | 2025-11-18 19:00 | 2025-11-18 19:30 | ~30분 | 1-2h | ✅ 완료 |

**구현 파일**:
- `packages/cli/src/services/template.service.ts` - giget 통합, scaffoldProject() 메서드
- `packages/cli/src/cli/template.handler.ts` - CLI 명령어 핸들러 (init, list, show)
- `packages/cli/package.json` - giget 의존성 추가

**완성된 템플릿 저장소** (Phase 4):
- ✅ GitHub Repository: https://github.com/sowonlabs/crewx-templates
- ✅ wbs-automation 템플릿 (8개 파일, 완전한 영어 문서)
- ✅ templates.json - 템플릿 레지스트리
- ✅ Root README.md - 저장소 소개 및 사용 가이드
- ✅ Template Manager Agent - 템플릿 검증 및 추가 자동화

**사용 예시**:
```bash
# 기본 사용 (sowonlabs/crewx-templates 저장소)
mkdir my-wbs-bot && cd my-wbs-bot
crewx template init wbs-automation

# 커스텀 저장소 사용 (회사/개인 템플릿)
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation

# 템플릿 목록 보기
crewx template list

# 템플릿 상세 정보
crewx template show wbs-automation
```

**다음 단계** (선택사항):
- Phase 5: 추가 문서화 및 E2E 테스트 (필요시)
- 공식 템플릿 저장소 생성: `https://github.com/sowonlabs/crewx-templates`
- 추가 템플릿 개발: docusaurus-admin, dev-team 등

---

## WBS-33: Template 서브커맨드 개선 (✅ 완료)
> 📄 [wbs/wbs-33-template-enhancement.md](wbs/wbs-33-template-enhancement.md)

**목표**: `crewx template` 서브커맨드 개선 (파일 보호 + 동적 리스트)

**예상 소요**: 2-3시간 (AI 작업 기준)

**전제 조건**: WBS-32 완료

**완료 시 할 수 있는 것**:
- `crewx template init` 재실행 시 기존 파일 보호 (덮어쓰기 방지)
- `crewx template init --force`로 명시적 덮어쓰기 가능
- `crewx template list`가 GitHub에서 동적으로 템플릿 목록 가져오기
- 환경변수로 회사 템플릿 저장소 사용 시에도 동적 리스트 표시
- 생성/스킵된 파일 개수 안내 메시지 출력

**Phase 진행 상황**:
- [✅] Phase 1: 파일 덮어쓰기 방지 (1-1.5시간) - 담당: crewx_claude_dev
- [✅] Phase 2: 동적 템플릿 리스트 (1-1.5시간) - 담당: crewx_codex_dev

**작업 시간 추적**:
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-11-19 17:09 | 2025-11-19 17:25 | ~16분 | 1-1.5h | ✅ |
| Phase 2 | crewx_codex_dev | 2025-11-19 18:05 | 2025-11-19 18:45 | ~40분 | 1-1.5h | ✅ |

**핵심 전략**:
- **crewx-quickstart 패턴**: 파일 덮어쓰기 방지 + `--force` 플래그
- **동적 템플릿 리스트**: GitHub에서 templates.json fetch + 캐싱

**Phase 1 완료 내용** (2025-11-19):
- ✅ `scaffoldProject()` 메서드에 파일 존재 체크 로직 추가
- ✅ 기본값: 기존 파일 스킵 (덮어쓰기 방지)
- ✅ `--force` 플래그 지원 (명시적 덮어쓰기)
- ✅ 생성/스킵 파일 개수 추적 및 표시
- ✅ TypeScript 빌드 검증 완료
- 📄 Thread Summary: `.crewx/threads/wbs-33-phase1-summary.md`

**Phase 2 완료 내용** (2025-11-19):
- ✅ `fetchTemplateList()`로 GitHub templates.json 동적 로드
- ✅ 저장소별 메모리 캐시 (5분 TTL) + 커스텀 repo 지원
- ✅ `crewx template list/show`가 templates.json 기반으로 정보 표시
- ✅ 네트워크/파싱 실패 시 빈 목록으로 폴백 + 경고 로그
- 📄 Thread Summary: `.crewx/threads/wbs-33-phase2-summary.md`

---

## WBS-34: Dynamic Tool Selection (동적 도구 선택) (⏸️ 보류)
> 📄 [wbs/wbs-34-dynamic-tool-selection.md](wbs/wbs-34-dynamic-tool-selection.md)

**목표**: vars 시스템과 Handlebars 템플릿을 활용한 동적 도구 선택

**예상 소요**: 3-4시간 (AI 작업 기준)

**상태**: ⏸️ 보류 (아이디어 정리 필요 - Phase 2까지 완료, Phase 3 재검토 예정)

**전제 조건**: 없음 (기존 템플릿 시스템 활용)

**완료 시 할 수 있는 것**:
- 에이전트 프롬프트에서 `{{#if vars.xxx}}` 조건문으로 도구 안내 제어
- 런타임 변수를 통해 도구 활성화 여부 동적 결정
- 환경별/상황별로 다른 도구 세트 사용
- CLI에서 `--vars` 옵션으로 런타임 제어 (Phase 3)

**Phase 진행 상황**:
- [⏸️] Phase 1: 프롬프트 조건부 (0분 - 이미 가능) - 보류
- [⏸️] Phase 2: 도구 목록 템플릿 처리 (1-2시간) - 보류
- [⏸️] Phase 3: CLI --vars 옵션 (2-3시간) - 보류 (아이디어 정리 필요)

**작업 시간 추적**:
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-11-19 18:01 | 2025-11-20 03:05 | ~4분 | 0분 | ⏸️ |
| Phase 2 | crewx_claude_dev | 2025-11-20 03:12 | 2025-11-20 03:45 | ~33분 | 1-2h | ⏸️ |

**핵심 전략**:
- **즉시 사용 가능**: 코드 변경 없이 현재 템플릿 시스템으로 조건부 프롬프트 구현
- **점진적 개선**: Phase 2, 3은 필요시 추가 구현
- **명시적 제어**: LLM 자동 선택이 아닌, vars로 명확한 제어

**Phase 1 구현 내용** (2025-11-19):
- ✅ 예제 에이전트 설정 생성 (examples/dynamic-tools/)
  - crewx.yaml: 4가지 패턴 (Multi-tool toggle, Simple toggle, Environment-based, Multi-condition)
  - README.md: 완전한 사용 가이드 및 예제
  - test-simple.yaml: 최소 테스트 케이스
  - VERIFICATION.md: 기술적 검증 문서
- ✅ vars 기반 조건부 프롬프트 검증
  - template-processor.ts의 vars 지원 확인 (line 57)
  - Handlebars 헬퍼 확인: eq, and, or, not
  - 빌드 검증 완료 (npm run build)
- ✅ 기능 확인: 코드 변경 없이 즉시 사용 가능 (Phase 1 완료)

**Phase 2 구현 내용** (2025-11-20):
- ✅ agent-loader.service.ts에 tools 필드 템플릿 처리 로직 추가
  - `processToolsField()` 메서드 구현 (line 818-861)
  - 지원: `string[]` (배열) 및 `string` (템플릿) 형식
  - Handlebars 조건부 로직 지원 (vars 기반)
  - 후방 호환성 유지 (기존 배열 형식 그대로 작동)
- ✅ 양쪽 agent 로딩 메서드에 적용
  - `loadBuiltInAgents()` (line 279-285)
  - `loadAgentsFromConfig()` (line 421-433)
- ✅ 테스트 케이스 작성
  - `tests/services/agent-loader-tools-template.test.ts`
  - 11개 테스트: 배열/템플릿/조건부/복잡한 로직 검증
- ✅ 빌드 검증 완료 (npm run build)
- ✅ 문서화
  - `docs/dynamic-tool-selection.md` 생성
  - 사용 가이드, 예제, 마이그레이션 가이드 포함

---

## WBS-35: Slack File Download (슬랙 파일 다운로드) (✅ 완료)
> 📄 [wbs/wbs-35-slack-file-download.md](wbs/wbs-35-slack-file-download.md)

**목표**: 슬랙에서 파일 업로드 시 자동 다운로드 및 AI 에이전트 통합

**실제 소요**: ~57분 (15+3+11+8+20분, AI 작업 기준, Phase 1-5)

**예상 대비**: 14-22시간 → 1시간 (AI 효율성! 🚀)

**전제 조건**: 없음 (독립적 기능)

**상태**: ✅ Phase 1-5 완료 (2025-11-20) - Hybrid 방식 (자동 + 수동)
- 🟢 구현 가능성: GREEN (100% 가능)
- 🟡 아키텍처: YELLOW (중간 참여 시나리오 대응)
- ✅ 핵심 개선: 중복 다운로드 방지 + CLI 명령어

**완료 기능**:
- ✅ 슬랙에서 파일 업로드 시 `.crewx/slack-files/{thread_ts}/`에 자동 다운로드
- ✅ **중복 다운로드 방지** (파일 존재 체크, 에이전트 메모리 부족 대응)
- ✅ **중간 참여 시나리오** 지원 (봇 없을 때 업로드된 파일도 히스토리 조회 시 다운로드)
- ✅ **AI 에이전트가 Layout 템플릿으로 파일 정보 자동 인지** (platform='slack' 조건부)
- ✅ **수동 다운로드 CLI 명령어** (`crewx slack:files --thread <id>`)
- ✅ 파일 크기/타입 제한으로 보안 유지 (10MB 기본값)
- ✅ 환경변수 재활용 (`SLACK_BOT_TOKEN`)

**Phase 진행 상황**:
- [✅] Phase 1: 기본 파일 다운로드 (5-7시간) - 자동 + 중복 방지 + 중간 참여
- [✅] Phase 2: AI 에이전트 통합 (2-3시간) - Layout 템플릿 기반 자동 통합
- [✅] Phase 3: CLI 명령어 추가 (2-3시간) - `crewx slack:files` 구현
- [✅] Phase 4: 설정 및 제한 (2-3시간) - ConfigService 확장
- [✅] Phase 5: 에러 처리 및 로깅 (2-3시간) - Rate limiting, 에러 핸들링, 성능 메트릭

**작업 시간 추적**:
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-11-20 12:14:53 | 2025-11-20 12:29:52 | ~15분 | 5-7h | ✅ |
| Phase 2 | crewx_claude_dev | 2025-11-20 12:33:15 | 2025-11-20 12:36:15 | ~3분 | 2-3h | ✅ |
| Phase 3 | crewx_claude_dev | 2025-11-20 13:24:12 | 2025-11-20 13:35:00 | ~11분 | 2-3h | ✅ |
| Phase 4 | crewx_claude_dev | 2025-11-20 14:26:38 | 2025-11-20 14:35:00 | ~8분 | 2-3h | ✅ |
| Phase 5 | crewx_claude_dev | 2025-11-20 15:22:30 | 2025-11-20 15:42:30 | ~20분 | 2-3h | ✅ |

**핵심 전략**:
- **Hybrid 방식**: 자동 다운로드 (기본) + 수동 다운로드 (CLI)
- **중복 방지**: `fs.existsSync()` 체크로 불필요한 API 호출 방지
- **환경변수 재활용**: `SLACK_BOT_TOKEN` 사용 (별도 인증 불필요)
- **Layout 통합**: `platform='slack'` 시 `<slack_files>` 블록 자동 렌더링
- **보안**: 파일 크기 제한 (10MB), 타입 검증, 경로 인젝션 방지 (sanitization)

**필요 권한**: Slack API - `files:read`, `files:write`
