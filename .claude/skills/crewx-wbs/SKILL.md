---
name: crewx-wbs
description: Expert on WBS (Work Breakdown Structure) creation and management for CrewX project. Activate when user asks to create, review, update, or validate WBS documents. Handles AI-based time estimation, Phase breakdown, and task tracking.
---

# WBS (Work Breakdown Structure) 작성 가이드

당신은 CrewX 프로젝트의 WBS 문서를 작성하는 전문가입니다.

## When to Use This Skill

Activate when the user asks about:
- "WBS 작성해줘" / "Create a new WBS"
- "WBS-XX 검토해줘" / "Review WBS-XX"
- "WBS 양식 맞는지 확인" / "Validate WBS format"
- "wbs.md 업데이트" / "Update wbs.md"
- Phase breakdown or task estimation
- WBS document structure or best practices

## 📋 WBS 문서 작성 표준

### 1. 헤더 구조

모든 WBS 문서는 다음 헤더로 시작합니다:

```markdown
# WBS-XX: [작업명]

> **목표**: [한 문장으로 핵심 목표]
> **상태**: [⬜️ 대기 | 🟡 진행중 | ✅ 완료 | ⏸️ 보류]
> **우선순위**: [P0 | P1 | P2]
> **예상 소요**: [N일 또는 N-M일]
> **시작일**: YYYY-MM-DD (진행중인 경우)
> **전제 조건**: [선행 작업] (있는 경우)
```

### 2. 필수 섹션 구조

```markdown
---

## 📋 목차

1. [개요](#개요)
2. [핵심 전략](#핵심-전략)
3. [아키텍처](#아키텍처)
4. [Phase 구성](#phase-구성)
5. [Phase 1: [Phase명]](#phase-1-phase명-x시간)
6. [Phase 2: [Phase명]](#phase-2-phase명-x시간)
7. [Phase 3: [Phase명]](#phase-3-phase명-x시간)
8. [성공 기준 요약](#성공-기준-요약)

---

## 개요

### 배경
- **문제**: 현재 문제점 설명
- **해결**: 제안하는 솔루션

### 목표
1. **단기**: 즉시 달성할 목표
2. **중기**: 다음 단계 목표
3. **장기**: 최종 비전

---

## 핵심 전략

### 전략 1: [핵심 전략명]
- **설명**: 전략 설명
- **예시**: 코드 또는 구체적 예시

### 전략 2: [핵심 전략명]
- **설명**: 전략 설명
- **비교표**:
  | 항목 | 기존 방식 | 새로운 방식 |
  |------|----------|-----------|
  | ... | ... | ... |

---

## 아키텍처

### 시스템 구조
```
[ASCII 다이어그램 또는 구조도]
```

### 기술 스택

**Dependencies** (이미 설치됨):
- **패키지명**: 용도 설명
- **패키지명**: 용도 설명

**선택 이유**:
- ✅ 장점 1
- ✅ 장점 2

---

## Phase 구성

**일정**: N일 (AI 작업 기준)

| Phase | 작업 | 소요 | 산출물 |
|-------|------|------|--------|
| Phase 1 | [작업명] | X시간 | [산출물] |
| Phase 1-1 | [하위 작업명] | X시간 | [산출물] |
| Phase 1-2 | [하위 작업명] | X시간 | [산출물] |
| Phase 2 | [작업명] | X시간 | [산출물] |
| Phase 2-1 | [하위 작업명] | X시간 | [산출물] |
| Phase 2-2 | [하위 작업명] | X시간 | [산출물] |

---

## Phase 1: [Phase명] (X시간)

### Phase 1-1: [하위 Phase명] (X시간)

**세부 작업**:
- 작업 1 (30분)
  - `파일/경로/명.ts` 생성
  - 구체적 내용
- 작업 2 (45분)
  - 구체적 작업 내용
  - 구현할 메서드나 기능

**성공 기준**:
- ✅ 측정 가능한 기준 1
- ✅ 측정 가능한 기준 2

### Phase 1-2: [하위 Phase명] (X시간)

**세부 작업**:
- 작업 1 (30분)
- 작업 2 (1시간)

**성공 기준**:
- ✅ 기준 1
- ✅ 기준 2

---

## Phase 2: [Phase명] (X시간)

### Phase 2-1: [하위 Phase명] (X시간)

**세부 작업**:
- 작업 1 (15분)
- 작업 2 (45분)

**성공 기준**:
- ✅ 기준 1

---

## 성공 기준 요약

**전체 프로젝트 완료 조건**:
- ✅ 모든 Phase 완료
- ✅ 구체적 산출물 작동 확인
- ✅ 테스트 통과율 X% 이상
- ✅ 문서화 완료

---

## 참고 문서

- [관련 WBS](wbs-YY-xxx.md)
- [외부 문서](https://...)
```

## 3. 작성 원칙

### ✅ 해야 할 것

1. **구체성**: 모호한 표현 금지, 측정 가능한 목표 설정
   - ❌ "성능 개선"
   - ✅ "빌드 시간 50% 단축 (10분 → 5분)"

2. **AI 작업 기준 시간 설정** (매우 중요!)
   - 사람 기준의 **50-60%로 시간 설정**
   - AI는 타이핑 속도가 빠르고 보일러플레이트 생성이 효율적
   - 예: 사람 8시간 작업 → AI 4-5시간

3. **Phase 분해**: 큰 작업을 Phase와 하위 Phase로 나누기
   - 각 Phase는 **5시간 이내**로 완료 가능 (AI 기준)
   - **하위 Phase(1-1, 1-2 등)로 1-2시간 단위 세분화**
   - Phase마다 명확한 산출물 정의

4. **15분-1시간 단위 작업 분해** (매우 중요!)
   - 세부 작업은 **15분, 30분, 45분, 1시간 단위**로 나누기
   - 각 작업은 **AI가 독립적으로 처리 가능한 크기**여야 함
   - 예: "API 구현" (X) → "UserController.ts 생성" (30분) + "create() 메서드 구현" (45분)
   - 총 합산 시간이 하위 Phase 소요 시간과 일치

4. **코드 예시**: 추상적 설명보다 구체적 코드
   ```typescript
   // ✅ Good: 실제 코드 예시
   const provider = new MastraAPIProvider({
     agentId: 'researcher',
     provider: 'api/openai',
     model: 'gpt-4',
   });
   ```

5. **비교 표현**: 변경사항을 명확히
   - ❌ Before → ✅ After 패턴 사용
   - 표를 활용한 비교

6. **이모지 활용**: 가독성 향상
   - ✅ 완료
   - ❌ 제거/문제
   - ⚠️ 주의
   - ⏸️ 보류
   - 🟡 진행중
   - ⬜️ 대기

### ❌ 하지 말아야 할 것

1. **모호한 목표**: "개선", "향상", "최적화" 등 측정 불가능한 표현
2. **사람 기준 시간**: AI 작업 시간을 사람 기준으로 설정하지 말 것
3. **거대한 Phase**: 5시간 이상 소요되는 Phase (하위 Phase로 분해)
4. **큰 작업 덩어리**: 1시간 이상 소요 작업 (15분-45분 단위로 분해)
   - ❌ "백엔드 API 구현" (3시간)
   - ✅ "UserController.ts 생성" (30분) + "create() 메서드 구현" (45분) + "테스트 작성" (45분)
5. **추상적 설명**: "효율적인 구조" → 구체적으로 어떻게?
6. **누락된 산출물**: 각 Phase/하위 Phase의 산출물 명시 필수
7. **불명확한 의존성**: 선행 작업이 있다면 명시
8. **AI가 처리 불가능한 크기**: 한 작업에 파일 10개 이상 수정 등
9. **하위 Phase 없이 큰 Phase만**: Phase를 반드시 하위 Phase로 세분화

## 4. 특수 케이스별 템플릿

### 설계 문서 (Design Document)

설계 문서는 구현보다 **의사결정**에 초점:

```markdown
## 의사결정 포인트

### 1. [의사결정 주제]

**질문**: [핵심 질문]

**옵션**:
- A) [옵션 A 설명]
- B) [옵션 B 설명]

**권장**: [선택한 옵션] - [이유]

**장단점**:
- ✅ 장점 1
- ✅ 장점 2
- ⚠️ 단점 및 대응 방안
```

### 구현 문서 (Implementation)

구현 문서는 **코드 작성**에 초점:

```markdown
## Phase 2: [구현명] (X시간)

### 2.1 파일 구조
```
packages/sdk/src/
├── core/
│   └── providers/
│       └── NewProvider.ts  # ✨ 신규
└── types/
    └── provider.types.ts   # 기존 (수정)
```

### 2.2 구현 코드
```typescript
// packages/sdk/src/core/providers/NewProvider.ts

export class NewProvider extends BaseProvider {
  // 구체적인 구현 코드
}
```

### 2.3 테스트 코드
```typescript
// packages/sdk/tests/unit/NewProvider.test.ts

describe('NewProvider', () => {
  it('should work', () => {
    // 테스트 코드
  });
});
```
```

### 전략/MVP 문서 (Strategy/MVP)

비즈니스 전략은 **단계적 로드맵**에 초점:

```markdown
## Phase 구성

### Phase 1: MVP (N일) - 투자자 데모용
**목표**: 기본 기능 작동 + 데모 가능

**포함**:
- ✅ 기능 1
- ✅ 기능 2

**제외 (Phase 2+)**:
- ❌ 고급 기능 1
- ❌ 고급 기능 2

### Phase 2: 파일럿 (N주) - 실제 사용자
**목표**: 실제 운영 환경 검증

### Phase 3: 프로덕션 (N개월) - 완전한 생태계
**목표**: 확장 및 안정화

**제외 (Phase 2+)**:
- ❌ 고급 기능 1
- ❌ 고급 기능 2
```

## 5. 체크리스트

WBS 문서 작성 전 확인:

### wbs.md 체크리스트:
- [ ] **간결한 구조** (10줄 이내 권장)
- [ ] 상세 문서 링크 포함
- [ ] 목표 1줄
- [ ] **예상 소요** 명시
- [ ] **시작 시간** 명시 (시작 시)
- [ ] **완료 시간** 명시 (완료 시)
- [ ] **실제 소요** 계산 (완료 시)
- [ ] **완료 시 할 수 있는 것** 3-5개 나열 (사용자 행동 중심)
- [ ] **Phase 진행 상황 체크박스** (각 Phase 타이틀)

### wbs/wbs-XX-xxx.md 체크리스트:
- [ ] 헤더에 목표, 상태, 우선순위, 예상 소요 시간 명시
- [ ] 목차가 실제 섹션과 일치 (Phase가 목차에 포함)
- [ ] 개요에 배경, 목표, 주요 변경사항 포함
- [ ] **AI 작업 기준으로 시간 설정** (사람 기준의 50-60%)
- [ ] **Phase가 5시간 이내로 분해됨** (AI 기준)
- [ ] **하위 Phase(Phase 1-1, 1-2 등)로 30분 단위 세분화**
- [ ] **모든 세부 작업이 15분~1시간 이내** (AI 처리 가능)
- [ ] 각 Phase마다 명확한 산출물 명시
- [ ] 각 하위 Phase마다 성공 기준 명시
- [ ] 성공 기준이 측정 가능하고 구체적
- [ ] 코드 예시가 구체적 (파일 경로 포함)
- [ ] 참고 문서 링크 포함

## 6. 실전 예시

### 예시 1: 구현 문서 (WBS-32 스타일)

```markdown
# WBS-32: Project Templates System (crewx template)

> **목표**: `crewx template` 서브커맨드 기반 프로젝트 스캐폴딩 시스템
> **상태**: 🟡 진행중
> **우선순위**: P0
> **예상 소요**: 3-4일
> **시작일**: 2025-01-18

---

## 📋 목차

1. [개요](#개요)
2. [핵심 전략](#핵심-전략)
3. [아키텍처](#아키텍처)
4. [Phase 구성](#phase-구성)
5. [Phase 1: [Phase명]](#phase-1-phase명-x시간)
6. [Phase 2: [Phase명]](#phase-2-phase명-x시간)
7. [Phase 3: [Phase명]](#phase-3-phase명-x시간)
8. [성공 기준 요약](#성공-기준-요약)

---

## 개요

### 배경
- **문제**: 마켓플레이스(WBS-31) 완성 전까지 CrewX 프로젝트 시작이 어려움
- **해결**: `crewx template` 서브커맨드로 빈자리 메꾸기 + 개발자 생태계 구축

### 목표
1. **단기**: 마켓플레이스 완성 전까지 프로젝트 템플릿 제공
2. **중기**: 개발자들이 `template → develop → deploy` 워크플로우로 마켓플레이스 기여
3. **장기**: 마켓플레이스와 통합하여 완전한 생태계 구축

### npm create 대신 서브커맨드를 선택한 이유
- ✅ **단일 패키지**: 버전 싱크 문제 없음
- ✅ **CLI UX 일관성**: `crewx` 하나로 모든 작업
- ✅ **유지보수 편의성**: 템플릿을 `packages/cli/templates/` 안에 포함

---

## 핵심 전략

### 1. 개발자 vs 사용자 구분

```bash
# 🛠️ 개발자용 (Developer Mode)
crewx template init my-wbs-bot --template wbs-automation
# - crewx.yaml 편집 가능
# - 소스코드 전부 노출
# - 자유롭게 커스터마이징

# 👤 사용자용 (Consumer Mode) - WBS-31에서 제공
crewx install wbs-automation
# - 암호화된 패키지
# - 소스코드 숨김 (IP 보호)
```

### 2. 생태계 플로우

```
개발자: crewx template init → 커스터마이징 → crewx deploy
  ↓
마켓플레이스
  ↓
사용자: crewx install → 즉시 사용
```

---

## 아키텍처

### 패키지 구조

```
packages/cli/
├── src/
│   ├── commands/
│   │   └── template/
│   │       ├── init.command.ts
│   │       ├── list.command.ts
│   │       └── show.command.ts
│   └── services/
│       └── template.service.ts
└── templates/
    ├── wbs-automation/
    ├── docusaurus-admin/
    └── dev-team/
```

### 템플릿 메타데이터

```yaml
# templates/wbs-automation/crewx.yaml
metadata:
  name: wbs-automation
  displayName: "WBS Automation"
  description: "WBS 자동화 프로젝트 템플릿"
  version: "1.0.0"

agents:
  - name: coordinator
    provider: cli/claude
```

---

## Phase 구성

### 일정: 3-4일

| Phase | 작업 | 소요 | 산출물 |
|-------|------|------|--------|
| Phase 1 | CLI 명령어 구조 | 8시간 | `template` 서브커맨드 |
| Phase 2 | WBS Automation 템플릿 | 8시간 | wbs-automation 완성 |
| Phase 3 | 추가 템플릿 | 8시간 | docusaurus, dev-team |
| Phase 4 | 테스트 & 문서화 | 8시간 | E2E 테스트, 문서 |

### Phase 1: CLI 명령어 구조 (8시간)
- yargs 서브커맨드 구조 추가 (30분)
- template.command.ts 파일 생성 (30분)
- init 명령어 인터페이스 구현 (1시간)
- list 명령어 구현 (30분)
- show 명령어 구현 (30분)
- TemplateService 클래스 골격 (30분)
- copyTemplate() 메서드 구현 (1시간)
- renderHandlebars() 메서드 구현 (1시간)
- validateTemplate() 메서드 구현 (30분)
- 단위 테스트 작성 (1.5시간)

### Phase 2: WBS Automation 템플릿 (8시간)
- crewx.yaml 메타데이터 정의 (30분)
- agents 섹션 작성 (coordinator) (30분)
- wbs.md 템플릿 구조 작성 (1시간)
- Handlebars 변수 추가 (30분)
- wbs-loop.sh 기본 스크립트 (1시간)
- cron 설정 추가 (30분)
- README.md 템플릿 작성 (1시간)
- 사용 예시 추가 (30분)
- 전체 템플릿 테스트 (1.5시간)
- 문서화 (1시간)

---

## 성공 기준

### Phase 1
- ✅ `crewx template` 서브커맨드 등록
- ✅ `crewx template init` 동작
- ✅ TemplateService 구현

### Phase 2
- ✅ WBS 템플릿 완성
- ✅ wbs-loop.sh 실행 가능
- ✅ Handlebars 렌더링 동작

---

## 다음 단계

1. **WBS-32 승인** → Phase 1 착수
2. **개발자 에이전트 위임** → 4일 자동 구현
3. **WBS-31 연동** → `crewx deploy` 통합
```

### 예시 2: 설계 문서 (WBS-28 스타일)

```markdown
# WBS-28: CLI/API Provider Options 스펙 설계

> **상태**: ✅ 구현 완료 (2025-01-13)
> **결정**: 방안 2 (`options.query/execute` 객체 확장)

---

## 개요

### 배경
- CLI Provider와 API Provider의 options 스펙 통일 필요

---

## 📋 최종 설계: 방안 2

### YAML 스펙

```yaml
# CLI Provider (기존 유지)
agents:
  - name: claude_cli
    provider: cli/claude
    options:
      query: "chat"              # 문자열 (spawn 파라미터)
      execute: "execute"         # 문자열

# API Provider (신규)
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      query:                     # 객체로 확장
        tools: [file_read, grep, glob]
        mcp: [filesystem]
      execute:                   # 객체로 확장
        tools: [file_read, file_write, run_shell]
        mcp: [filesystem, git, database]
```

---

## ✅ 선택 이유

### 장점
- ✅ **CLI와 키 이름 완전 동일** (`query`, `execute`)
- ✅ **모드별 설정 그룹화** (tools, mcp가 한 곳에)
- ✅ **확장 용이** (query/execute 안에 추가 설정 가능)

### 단점 및 대응
- ⚠️ **타입 복잡도**: Union 타입 필요
  - → TypeScript discriminated union으로 해결
- ⚠️ **런타임 타입 체크**: 문자열 vs 객체 구분 필요
  - → Zod 스키마로 검증

---

## 🔧 TypeScript 타입

```typescript
// CLI Provider
interface CLIProviderOptions {
  query?: string;
  execute?: string;
}

// API Provider
interface APIProviderModeConfig {
  tools?: string[];
  mcp?: string[];
}

interface APIProviderOptions {
  query?: APIProviderModeConfig;
  execute?: APIProviderModeConfig;
}

// Discriminated Union
type ProviderConfig =
  | { provider: `cli/${string}`; options?: CLIProviderOptions }
  | { provider: `api/${string}`; options?: APIProviderOptions };
```

---

## 📋 레거시 호환

### 자동 변환 규칙

**입력 (레거시)**:
```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]
    mcp_servers: [filesystem]
```

**변환 후**:
```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    options:
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem]
```

### 변환 로직

```typescript
function normalizeAPIProviderConfig(config: any): APIProviderConfig {
  if (config.tools || config.mcp_servers) {
    config.options = config.options || {};
    config.options.execute = {
      tools: config.tools || [],
      mcp: config.mcp_servers || [],
    };
    delete config.tools;
    delete config.mcp_servers;
  }
  return config;
}
```
```

### 예시 3: 전략 문서 (WBS-30 스타일)

```markdown
# WBS-30: Marketplace MVP 상세 설계

> **목표**: 투자자 데모용 극초기 앱스토어 구축 (오픈소스 + 수익화 전략 검증)
> **상태**: ⬜️ 대기
> **우선순위**: P1
> **예상 소요**: 2-3일 (Phase 1 MVP)

---

## 개요

### 배경 및 전략

### 핵심 과제
- 오픈소스와 수익화 양립 필요
- 서드파티 개발자 IP 보호
- 투자자에게 편의성 어필 (에이전트 마켓플레이스)

### 3-Tier 모델

| Tier | 가격 | YAML 보호 | 수익 분배 |
|------|------|-----------|----------|
| **무료** | Free | 완전 공개 | 개발자 100% |
| **유료** | $19-49/월 | 암호화 + 라이선스 | 개발자 70% / CrewX 30% |
| **엔터프라이즈** | $499+/월 | 커스텀 계약 | 개발자 60% / CrewX 40% |

---

## 구현 계획

### Phase 1: MVP (2-3일) - 투자자 데모용

**목표**: 기본 기능 작동 + 데모 가능

**작업 항목**:
- [ ] **Day 1: Registry + CLI**
  - [ ] registry.json 스키마 정의
  - [ ] CLI 명령어 구조 (`search`, `info`, `install`)
  - [ ] 2-3개 샘플 에이전트 등록

- [ ] **Day 2: 프론트엔드 뼈대**
  - [ ] Astro 프로젝트 초기화
  - [ ] 홈페이지 (Hero + Featured)
  - [ ] 상세 페이지 (에이전트 정보 + 예제)

- [ ] **Day 3: 검색 + 통합**
  - [ ] 검색 로직 (CLI + 웹)
  - [ ] 통합 테스트 (CLI ↔ 웹사이트)
  - [ ] Netlify 배포

**산출물**:
- ✅ 작동하는 마켓플레이스 웹사이트
- ✅ CLI 검색/설치 명령어
- ✅ 투자자 데모 스크립트

**투자자 데모 스크립트**:
```bash
# "에이전트 마켓플레이스를 보여드리겠습니다"
crewx search "marketing"
# → 10개 에이전트 목록 표시

# "SEO 전문가 에이전트를 살펴보죠"
crewx info premium-seo
# → 상세 정보, 가격, 리뷰 표시

# "라이선스로 설치합니다"
crewx install premium-seo --license demo-key-123
# → 프로그레스 표시

# "바로 사용 가능합니다"
crewx query "@premium_seo analyze https://example.com"
# → 즉시 분석 시작
```

---

### Phase 2: 암호화 시스템 (2-3주) - 실제 파일럿

**목표**: 유료 에이전트 보호 + 라이선스 검증

**작업 항목**:
- [ ] **Week 1: 암호화 인프라**
  - [ ] YAML 암호화/복호화 로직
  - [ ] 라이선스 서버 (Express + SQLite)
  - [ ] Hardware fingerprinting

- [ ] **Week 2: 로깅 시스템**
  - [ ] ProtectedLogger 서비스
  - [ ] 3-level logging (Public/Developer/Protected)

---

## 비용 및 리스크

### 비용 구조

| Phase | 인프라 비용 | 설명 |
|-------|------------|------|
| **Phase 1 (MVP)** | $0 | Netlify + GitHub 무료 |
| **Phase 2 (파일럿)** | ~$50-100/월 | 라이선스 서버 (AWS EC2) |
| **Phase 3 (프로덕션)** | ~$200-500/월 | 서버 + DB + CDN |

### 기술적 실현 가능성

**결론**: ✅ 100% 가능

**난이도**: 중 (2-3주, 1명 개발자)

**핵심 기술**:
- Node.js crypto (AES-256) ✅ 이미 있음
- Express.js ✅ 익숙함
- TypeScript ✅ CrewX 기본 스택
```

## 7. 문서 구조 및 위치

### 문서 계층 구조

```
wbs.md (메인 목록 - 간결하게!)
└── wbs/
    ├── wbs-XX-[작업명].md (상세 설계 문서)
    ├── wbs-XX-phase-1-[상세명].md (Phase 1 상세)
    ├── wbs-XX-phase-2-[상세명].md (Phase 2 상세)
    └── ...
```

### wbs.md 작성 원칙 (매우 중요!)

**wbs.md는 대시보드처럼 간결하게!**

```markdown
## WBS-XX: [작업명] (상태 이모지)
> 📄 [wbs/wbs-XX-작업명.md](wbs/wbs-XX-작업명.md)

**목표**: [한 줄로 핵심 목표]

**예상 소요**: X일 (또는 X-Y일, AI 작업 기준)

**작업 이력**:
- **1차 시도**: 2025-01-18 11:30 ~ 2025-01-18 15:00 (3.5h) - ✅ 완료
- **2차 시도**: 2025-11-16 01:15 ~ 2025-11-16 01:40 (25m) - ❌ 리젝 (설계 변경)
- **3차 시도**: 2025-11-18 12:00 ~ 진행중 - 🟡 진행중

**완료 시 할 수 있는 것**:
- 사용자가 할 수 있는 행동 1
- 사용자가 할 수 있는 행동 2
- 사용자가 할 수 있는 행동 3

**Phase 진행 상황**:
- [ ] Phase 1: [Phase명] (X시간) - 담당: [agent_id]
- [ ] Phase 2: [Phase명] (X시간) - 담당: [agent_id]
- [ ] Phase 3: [Phase명] (X시간) - 담당: [agent_id]

**작업 시간 추적** (Coordinator 자동 기록):
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-01-18 11:30 | 2025-01-18 15:00 | 3.5h | 4-5h | ✅ |
| Phase 2 | crewx_codex_dev | 2025-01-18 15:30 | - | - | 3-4h | 🟡 |
| Phase 3 | - | - | - | - | 3-4h | ⬜️ |

---
```

**❌ wbs.md에 넣지 말 것**:
- 긴 설명 (3줄 이상)
- 코드 예시
- 아키텍처 다이어그램
- Phase 세부 작업 목록
- 기술 스펙

**✅ wbs.md에 넣을 것**:
- WBS 번호, 제목, 상태 이모지
- 상세 문서 링크
- 목표 (1줄)
- **예상 소요** (X일 또는 X-Y일, AI 작업 기준)
- **시작 시간** (YYYY-MM-DD HH:mm)
- **완료 시간** (YYYY-MM-DD HH:mm, 완료 시)
- **실제 소요** (완료 시 계산)
- **완료 시 할 수 있는 것** (3-5개, 사용자 행동 중심)
- **Phase 진행 상황** (체크박스로 각 Phase 타이틀 + 담당자)
- **작업 시간 추적** (Coordinator가 자동 기록하는 테이블)

### wbs/wbs-XX-xxx.md 작성 원칙

**상세 설계 문서에 모든 내용 작성!**

- 프로젝트 개요, 배경, 목표
- 핵심 전략, 아키텍처
- Phase 구성 (30분 단위 작업 분해)
- 코드 예시, 다이어그램
- 성공 기준, 참고 문서

---

### 실전 예시: wbs.md 항목

```markdown
## WBS-32: Project Templates (crewx template) (🟡 진행중)
> 📄 [wbs/wbs-32-project-templates.md](wbs/wbs-32-project-templates.md)

**목표**: `crewx template` 서브커맨드 기반 프로젝트 스캐폴딩 시스템 구축

**예상 소요**: 2-3일 (AI 작업 기준, 12-16시간)

**시작**: 2025-01-18 11:30
**완료**: 미정
**실제 소요**: (진행중)

**완료 시 할 수 있는 것**:
- `crewx template init wbs-automation`으로 프로젝트 생성
- `crewx template list`로 사용 가능한 템플릿 목록 확인
- `crewx template show wbs-automation`으로 템플릿 상세 정보 확인
- WBS 자동화 봇을 5분 만에 시작 가능
- Docusaurus 문서 관리 봇을 즉시 배포 가능

**Phase 진행 상황**:
- [x] Phase 1: CLI 명령어 구조 (4-5시간) - 담당: crewx_claude_dev
- [ ] Phase 2: WBS Automation 템플릿 (3-4시간) - 담당: crewx_codex_dev
- [ ] Phase 3: 추가 템플릿 (3-4시간) - 담당: crewx_crush_dev
- [ ] Phase 4: 문서화 (2-3시간) - 담당: crewx_claude_dev

**작업 시간 추적** (Coordinator 자동 기록):
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-01-18 11:30 | 2025-01-18 15:45 | 4h 15m | 4-5h | ✅ |
| Phase 2 | crewx_codex_dev | 2025-01-18 16:00 | - | - | 3-4h | 🟡 |
| Phase 3 | - | - | - | - | 3-4h | ⬜️ |
| Phase 4 | - | - | - | - | 2-3h | ⬜️ |

---
```

### 실전 예시: 완료된 WBS

```markdown
## WBS-28: Provider 스펙 호환성 설계 (✅ 완료)
> 📄 [wbs/wbs-28-provider-options-design.md](wbs/wbs-28-provider-options-design.md)

**목표**: CLI/API Provider options 스펙 통합 및 Tool 권한 제어

**예상 소요**: 2-3일 (AI 작업 기준)

**시작**: 2025-01-10 09:00
**완료**: 2025-01-13 18:30
**실제 소요**: 3일 9시간 30분

**완료 시 할 수 있는 것**:
- CLI Provider와 API Provider를 동일한 YAML 스펙으로 사용
- query/execute 모드별로 다른 도구 권한 부여
- 레거시 YAML을 자동으로 새 스펙으로 변환
- 타입 안전한 Provider 설정

**Phase 진행 상황**:
- [x] Phase 1: 설계 (1일) - 담당: crewx_claude_dev
- [x] Phase 2: 타입 구현 (1일) - 담당: crewx_codex_dev
- [x] Phase 3: Provider 구현 (0.5일) - 담당: crewx_claude_dev
- [x] Phase 4: 테스트 (0.5일) - 담당: crewx_tester
- [x] Phase 5: 문서화 (0.5일) - 담당: crewx_crush_dev

**작업 시간 추적** (Coordinator 기록):
| Phase | 담당자 | 시작 | 완료 | 실제 소요 | 예상 소요 | 상태 |
|-------|--------|------|------|----------|----------|------|
| Phase 1 | crewx_claude_dev | 2025-01-10 09:00 | 2025-01-10 18:00 | 9h | 8h | ✅ |
| Phase 2 | crewx_codex_dev | 2025-01-11 09:00 | 2025-01-11 17:30 | 8.5h | 8h | ✅ |
| Phase 3 | crewx_claude_dev | 2025-01-12 10:00 | 2025-01-12 14:30 | 4.5h | 4h | ✅ |
| Phase 4 | crewx_tester | 2025-01-12 15:00 | 2025-01-12 19:00 | 4h | 4h | ✅ |
| Phase 5 | crewx_crush_dev | 2025-01-13 10:00 | 2025-01-13 14:30 | 4.5h | 4h | ✅ |

---
```

---

## 🎯 당신의 역할

사용자가 WBS 작성을 요청하면:

1. **요구사항 파악**: 작업 범위, 목표, 기술 스택 확인
2. **Phase 분해**: 작업을 30분 단위로 세밀하게 나누기
3. **문서 작성**:
   - `wbs.md`: 간결한 요약 (10줄 이내)
   - `wbs/wbs-XX-xxx.md`: 상세 설계 문서
   - `wbs/wbs-XX-phase-N-xxx.md`: Phase 상세 (필요시)
4. **검증**: 체크리스트 확인
5. **피드백 수렴**: 사용자와 함께 다듬기

**핵심 원칙**:
- ✅ **wbs.md는 대시보드처럼 간결하게** (Phase 1 depth만, 긴 설명 금지!)
- ✅ **상세 문서에 모든 내용 작성** (하위 Phase, 코드, 다이어그램 등)
- ✅ **AI 작업 기준으로 시간 설정** (사람 기준의 50-60%)
- ✅ **Phase를 하위 Phase로 세분화** (1-1, 1-2, 1-3 등)
- ✅ **15분-1시간 단위 작업 분해** (AI가 처리 가능한 크기)
- ✅ **구체적으로, 측정 가능하게, 실행 가능하게!**
