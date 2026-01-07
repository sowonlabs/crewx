# Smoke Test Guide

RC 배포 전 필수로 수행해야 하는 스모크 테스트 가이드입니다.

## 배경

0.7.8 릴리즈에서 발생한 문제들을 예방하기 위해 작성되었습니다:
- `--thread` 옵션이 특정 Provider에서 동작하지 않는 문제
- Conversation history가 실제로 LLM에 전달되지 않는 문제
- Provider별 기본 동작 검증 누락

---

## 필수 테스트 항목

### 1. Provider별 --thread 옵션 테스트

각 Provider에서 대화 히스토리가 정상 동작하는지 확인합니다.

#### cli/claude Provider 테스트

```bash
# 1. 첫 번째 메시지 전송
crewx q "@crewx_claude_dev 안녕! 내 이름은 테스터야. 기억해줘." --thread smoke-test-claude

# 2. 두 번째 메시지로 기억 확인
crewx q "@crewx_claude_dev 내 이름이 뭐라고 했지?" --thread smoke-test-claude
```

**예상 결과:**
- 두 번째 응답에서 "테스터"라는 이름을 기억해야 함

#### cli/codex Provider 테스트

```bash
# 1. 첫 번째 메시지 전송
crewx q "@crewx_codex_dev 안녕! 내 이름은 테스터야. 기억해줘." --thread smoke-test-codex

# 2. 두 번째 메시지로 기억 확인
crewx q "@crewx_codex_dev 내 이름이 뭐라고 했지?" --thread smoke-test-codex
```

**예상 결과:**
- 두 번째 응답에서 "테스터"라는 이름을 기억해야 함

#### cli/gemini Provider 테스트 (선택)

```bash
# 1. 첫 번째 메시지 전송
crewx q "@crewx_gemini_dev 안녕! 내 이름은 테스터야. 기억해줘." --thread smoke-test-gemini

# 2. 두 번째 메시지로 기억 확인
crewx q "@crewx_gemini_dev 내 이름이 뭐라고 했지?" --thread smoke-test-gemini
```

---

### 2. Conversation History 검증

로그 파일에서 실제 대화 내역이 포함되는지 확인합니다.

#### 로그 파일 확인 방법

```bash
# 최신 로그 파일 확인
ls -lt .crewx/logs/ | head -5

# 로그 파일 내용에서 conversation_history 섹션 검색
grep -l "conversation_history" .crewx/logs/*.json | head -1 | xargs cat
```

#### 확인 사항

1. **로그 파일 존재 여부**
   - `.crewx/logs/` 디렉토리에 로그 파일이 생성되어야 함

2. **`<conversation_history>` 섹션 확인**
   - 두 번째 메시지의 로그 파일에 이전 대화 내역이 포함되어야 함
   - 형식: `<conversation_history>` 태그 내에 이전 메시지들이 있어야 함

3. **실제 LLM 응답에서 기억 확인**
   - LLM이 이전 대화를 참조하여 응답하는지 확인

---

### 3. 각 Provider 기본 동작 테스트

각 Provider가 에러 없이 기본 응답을 반환하는지 확인합니다.

```bash
# cli/claude
crewx q "@claude:haiku 1+1은?"

# cli/codex
crewx q "@crewx_codex_dev 1+1은?"

# cli/gemini
crewx q "@gemini 1+1은?"
```

**예상 결과:**
- 모든 Provider에서 에러 없이 "2" 관련 응답을 받아야 함
- 타임아웃이나 연결 오류가 없어야 함

---

## RC 배포 전 체크리스트

### 필수 항목

- [ ] **cli/claude --thread 테스트 통과**
  - [ ] 첫 번째 메시지 정상 전송
  - [ ] 두 번째 메시지에서 이전 대화 기억 확인

- [ ] **cli/codex --thread 테스트 통과**
  - [ ] 첫 번째 메시지 정상 전송
  - [ ] 두 번째 메시지에서 이전 대화 기억 확인

- [ ] **Conversation History 로그 확인**
  - [ ] .crewx/logs/ 에 로그 파일 생성됨
  - [ ] 두 번째 메시지 로그에 `<conversation_history>` 섹션 존재

- [ ] **Provider 기본 동작 확인**
  - [ ] cli/claude 응답 정상
  - [ ] cli/codex 응답 정상
  - [ ] cli/gemini 응답 정상 (선택)

### 선택 항목

- [ ] **실제 사용 시나리오 테스트**
  - [ ] 문서 참조 기능 동작 확인
  - [ ] 템플릿 변수 치환 확인
  - [ ] MCP 모드 테스트 (해당되는 경우)

---

## 테스트 실패 시 대응

### --thread 테스트 실패

1. Provider 코드에서 `--resume` 또는 `--thread` 관련 옵션 전달 확인
2. ConversationHistoryProvider 구현 확인
3. 로그 파일에서 conversation_history 포함 여부 확인

### 로그 파일에 conversation_history 없음

1. `ConversationHistoryProvider.formatForPrompt()` 호출 여부 확인
2. 프롬프트 빌드 과정에서 히스토리 주입 확인
3. Provider별 프롬프트 구조 확인

### Provider 기본 동작 실패

1. API 키 설정 확인 (환경 변수)
2. Provider CLI 도구 설치 여부 확인
3. 네트워크 연결 상태 확인

---

## 스모크 테스트 결과 보고

테스트 완료 후 결과를 다음 형식으로 보고합니다:

```markdown
## Smoke Test Report - [날짜]

### 테스트 환경
- Branch: release/X.X.X
- Commit: [commit hash]
- 테스터: [agent/person name]

### 결과 요약
| 테스트 항목 | 결과 |
|------------|------|
| cli/claude --thread | PASS/FAIL |
| cli/codex --thread | PASS/FAIL |
| Conversation History 로그 | PASS/FAIL |
| Provider 기본 동작 | PASS/FAIL |

### 상세 결과
[각 테스트 항목별 상세 결과 기록]

### 이슈
[발견된 문제점 기록]
```

---

## 관련 문서

- [QA Tester 가이드](../prompts/qa-tester.md)
- [Report Structure](../standards/report-structure.md)
- [Release Workflow](../process/release-workflow.md)
