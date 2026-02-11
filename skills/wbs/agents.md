# Available Agents

WBS Job 배정 시 참고할 프로젝트 에이전트 목록입니다.

## Development Agents

### @crewx_claude_dev
- **Role**: Lead Developer
- **Model**: opus (Claude)
- **Complexity**: 복잡한 작업 (30-45분)
- **Best for**: 아키텍처 설계, 복잡한 구현, 코드 리뷰

### @crewx_gemini_dev
- **Role**: Lead Developer
- **Model**: gemini-3-pro-preview
- **Complexity**: 복잡한 작업 (30-45분)
- **Best for**: 대안적 구현, Gemini 특화 작업

### @crewx_codex_dev
- **Role**: Senior Developer
- **Model**: Codex
- **Complexity**: 중-고급 작업 (25-35분)
- **Best for**: 코드 생성, 리팩토링

### @crewx_crush_dev
- **Role**: Developer
- **Model**: Crush (multi-model)
- **Complexity**: 중간 작업 (20-30분)
- **Best for**: 일반 개발, 빠른 작업

## QA Agents

### @crewx_qa_lead
- **Role**: QA Lead
- **Model**: sonnet (Claude)
- **Best for**: 테스트 전략, 릴리스 결정

### @crewx_tester
- **Role**: Tester
- **Model**: sonnet (Claude)
- **Best for**: 테스트 실행, 버그 검증

## Management Agents

### @crewx_dev_lead
- **Role**: Dev Lead
- **Model**: sonnet (Claude)
- **Best for**: 이슈 할당, 프로젝트 조율

### @crewx_release_manager
- **Role**: Release Manager
- **Model**: sonnet (Claude)
- **Best for**: 릴리스 프로세스, 브랜치 관리

## Specialized Agents

### @sowonflow_claude_dev
- **Role**: SowonFlow Developer
- **Model**: sonnet (Claude)
- **Working Dir**: /Users/doha/git/sowonai/packages/sowonflow
- **Best for**: SowonFlow 분석, LangGraph 패턴 참조

### @gemini_cli_analyzer
- **Role**: Gemini CLI Analyzer
- **Model**: sonnet (Claude)
- **Working Dir**: /Users/doha/git/gemini-cli
- **Best for**: Gemini CLI 분석, 포팅

### @mastra_analyzer
- **Role**: Mastra Framework Analyst
- **Model**: sonnet (Claude)
- **Working Dir**: /Users/doha/git/mastra
- **Best for**: Mastra Agent/Tool 분석

---

## Job 배정 가이드라인

**주의: 내장 에이전트(@claude:haiku, @claude:sonnet, @claude:opus)는 사용하지 마세요. 프로젝트 에이전트만 사용합니다.**

| 작업 유형 | 권장 Agent | 예상 시간 |
|----------|-----------|----------|
| 단순 파일 수정 | @crewx_crush_dev | 20-30분 |
| 기능 구현 | @crewx_codex_dev | 25-35분 |
| 복잡한 모듈 구현 | @crewx_claude_dev | 30-45분 |
| 테스트 작성 | @crewx_tester | 20-30분 |
| 코드 리뷰 | @crewx_qa_lead | 20-30분 |
| 아키텍처 설계 | @crewx_claude_dev | 30-45분 |
| SowonFlow 참조 | @sowonflow_claude_dev | 25-35분 |
| Mastra 분석 | @mastra_analyzer | 25-35분 |
