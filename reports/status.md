# 📊 CrewX 프로젝트 현황판
> 마지막 업데이트: 2025-12-01

## 🎯 현재 진행 중인 작업

### 🚀 릴리스: 0.7.6
- **최신 배포**: v0.7.6-rc.3 (2025-11-28, npm next 태그)
- **release/0.7.6 브랜치**: 2개 이슈 머지 완료
- **담당**: QA팀장, 릴리스 매니저
- **다음 액션**: QA 테스트 → 정식 릴리스
- **블로커**: 없음

## 🐛 버그 & 기능 현황 (0.7.6 대상)

### ✅ Release/0.7.6 브랜치에 포함됨 (머지 완료) - 2개
| ID | 제목 | 타입 | 상태 | 머지 커밋 |
|----|------|------|------|---------|
| 97b5631 | Slack 대화 컨텍스트에 채널/스레드 ID 추가 | bug | resolved | rc.3 완전수정 ✅ |
| 98a6656 | Documents not rendered in layout templates | bug | resolved | rc.1 → rc.2 완전수정 |

**97b5631 상세**:
- **문제**: Slack provider에서 대화 컨텍스트에 channel_id, thread_ts 누락
- **영향**: 에이전트가 스레드에 파일 업로드 등 작업 불가
- **근본 원인 (rc.3에서 발견)**:
  1. Zod 스키마에 `platform`, `metadata` 필드 누락 → validation 시 제거됨
  2. 필드명 불일치: slack-bot.ts는 `platformMetadata`로 보내고, crewx.tool.ts는 `metadata`로 받음
- **수정 이력**:
  - rc.0: platformMetadata로 channel_id, thread_ts 전달 (불완전)
  - rc.2: renderContext에 metadata 추가 (불완전)
  - **rc.3**: Zod 스키마 수정 + 필드명 통일 (`platformMetadata` → `metadata`) ✅
- **파일**: slack-bot.ts, crewx.tool.ts
- **해결자**: Codex 개발자 (@crewx_codex_dev)

**98a6656 상세**:
- **문제**: crewx.yaml의 documents 섹션에 정의된 문서가 layout Handlebars 템플릿에서 렌더링되지 않음
- **영향**: `{{{documents.xxx.content}}}` 문법이 작동하지 않아 프롬프트에 문서 내용이 포함되지 않음
- **수정 (rc.1)**: crewx.tool.ts에서 documents 객체를 templateContext에 추가
- **수정 (rc.2)**: template-processor.ts에서 additionalContext.documents 사용하도록 수정
- **파일**: crewx.tool.ts, template-processor.ts

### 🔄 RC History
- **rc.0** (2025-11-27): Slack channel_id/thread_ts 컨텍스트 추가 (97b5631 - 불완전)
- **rc.1** (2025-11-28): Documents 템플릿 렌더링 수정 (98a6656 - 불완전)
- **rc.2** (2025-11-28): 97b5631 + 98a6656 추가 수정 (불완전)
- **rc.3** (2025-11-28): 97b5631 완전 수정 - Zod 스키마 + 필드명 통일 (Codex) ✅

**Progress**: 100% (2/2 머지 완료) ✅ → QA 대기

### 📋 재발방지 대책
템플릿 버그 재발방지를 위한 문서화 완료:
- **Template Modification Rules**: `CLAUDE.md` - 템플릿 코드 수정 시 필수 체크리스트
- **Smoke Test Checklist**: `packages/cli/CREWX.md` - RC 배포 전 필수 테스트 항목
- **Data Flow Pipeline**: `packages/cli/CREWX.md` - 템플릿 렌더링 파이프라인 문서화

## 📌 다음 할 일

### 🔴 우선순위 1 (긴급)
- [ ] **0.7.6-rc.3 QA 테스트**: Slack 메타데이터 렌더링 + Documents 렌더링 확인
- [ ] **0.7.6 정식 릴리스**: QA 통과 후

### 🟡 우선순위 2 (중요)
- [ ] **WBS-19 완료**: API Provider 설계 문서 마무리

### 🟢 우선순위 3 (일반)
- [ ] 버그 트리아지 (새로 들어온 이슈 확인)

## 🔗 Quick Links

### 개발 프로세스
- [개발 워크플로우](docs/process/development-workflow.md) - 버그/릴리스 프로세스, git-bug 사용법
---
**Note**: 에이전트들은 작업 시작 전 이 파일을 참고하여 현재 진행 상황을 파악하세요.
