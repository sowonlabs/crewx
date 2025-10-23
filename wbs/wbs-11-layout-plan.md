[← WBS 개요](../wbs.md)

# WBS-11 레이아웃 시스템 기획

## 개요
- **목표**: YAML 기반 레이아웃 선택 체계를 정의하고 커스텀·스토어 확장을 대비한 설계 문서를 마련한다.
- **우선순위**: High (다중 레이아웃 도입 전 필수)
- **예상 기간**: 2일
- **선행 디펜던시**: WBS-10 (SDK 완성도 확보)
- **핵심 산출물**
  - 레이아웃 YAML DSL 명세 및 예제 2종
  - 레지스트리 로딩 플로우 다이어그램
  - QA 및 위험 요소 점검 리스트

## Phase 계획 (단순화)
- **Phase 1: 레이아웃 DSL 요구사항 정리**
  - `inline.layout` 스펙 정의 (문자열 ID 기본, `{ id, props? }` 확장형 허용)와 `inline.prompt` 분리
  - Props 스키마를 **React PropTypes 스타일**로 정의
  - 샘플 레이아웃 2종 초안 작성 (`builtin/default`, `builtin/dashboard`)
  - Builtin 레이아웃은 `templates/agents/<name>.yaml`에 정의

- **Phase 2: 레이아웃 로더 구현 설계 (단순화)**
  - Builtin 레이아웃 로딩 (`templates/agents/*.yaml`)
  - Props 검증 흐름 (React PropTypes 스타일)
  - crewx.yaml에서 props 오버라이드 처리
  - Fallback: `builtin/default`

~~- **Phase 3: 운영/스토어 연계** (제거됨 - 복잡도 감소)~~

## 레이아웃 DSL 예시 (초안)
- 초기 콘셉트로 공유했던 인라인 레이아웃 템플릿 활용 예시:
```yaml
layouts:
  default: |
    <crewx_system_prompt>
    You are a built-in AI agent of the CrewX system.
    <document name="CrewX User Manual">
    {{{documents.crewx-manual.content}}}
    </document>
    </crewx_system_prompt>
    <system_prompt key="{{vars.security_key}}">
    {{{agent.inline.prompt}}}
    </system_prompt>
  minimal: |
    <system_prompt key="{{vars.security_key}}">
    {{{agent.inline.prompt}}}
    </system_prompt>
  my-layout1: |
    <crewx_system_prompt>
    {{{documents.user-query-security.content}}}
    </crewx_system_prompt>
    <system_prompt key="{{vars.security_key}}">
    {{{agent.inline.prompt}}}
    </system_prompt>
  builtin/dashboard: |
    <crewx_system_prompt>
    {{{documents.builtin-agent-guidelines.content}}}
    </crewx_system_prompt>

agents:
  - id: copilot
    name: "GitHub Copilot"
    inline:
      layout: "my-layout1"
      prompt: |
        You are GitHub Copilot, an AI coding assistant for CrewX.
        {{{documents.builtin-agent-guidelines.content}}}
```

- 확장형 예시 (props 포함):
```yaml
agents:
  - id: claude
    inline:
      layout:
        id: builtin/dashboard
        props:
          sidebarTheme: light
          showTimeline: true
      prompt: |
        You are Claude, a CrewX reasoning specialist.
```

- 프로젝트가 `layouts/<vendor>/<name>.yaml`을 추가하면 동일한 `layout` ID를 우선 적용해 빌트인 기본값을 자연스럽게 오버라이드합니다.
- `inline.layout`을 생략하면 기본값으로 `builtin/default`를 사용하고, 해당 정의는 `templates/agents/default.yaml`에 포함된 레이아웃이 제공하도록 합니다.

## SOLID 기반 설계 메모
- **Single Responsibility**: 레지스트리는 매니페스트 로딩과 검증만 담당하고, 레이아웃 렌더러는 프롬프트 조합/출력에만 집중.
- **Open/Closed**: `inline.layout`이 문자열과 Object 두 형태를 지원해 기존 사용자는 그대로 두고 props 확장만 추가하도록 설계.
- **Liskov Substitution**: 모든 레이아웃 매니페스트는 동일 스키마(`id`, `structure`, `slots`, `propsSchema`)를 따른다. 어떤 레이아웃이든 교체해도 소비 측 로직이 깨지지 않는다.
- **Interface Segregation**: 에이전트 설정에서는 `layout`(문자열 또는 `{ id, props? }`)과 `prompt`만 필수로 요구하고, `props`는 필요한 경우에만 선택적으로 선언.
- **Dependency Inversion**: 템플릿은 레지스트리가 제공하는 추상화된 레이아웃 데이터(`id`, `props`, `prompt`)에 의존하고, 실제 구현(빌트인/프로젝트/스토어)은 레지스트리에 주입된다.

## 후속 고려사항
- CLI/IDE에서 레이아웃 선택 UX 초안 (명령어, 환경 변수, 프로젝트 설정)을 Phase 2 이후 논의
- 앱스토어 번들 서명·버전 정책은 거버넌스 팀과 협업 필요 (추후 WBS-12 이상에서 다룸)
