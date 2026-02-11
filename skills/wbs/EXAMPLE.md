# WBS 사용 예제

이 문서는 WBS 스킬을 사용하여 실제 프로젝트를 진행하는 예제를 담고 있습니다.

## 시나리오: 블로그 시스템 구축

간단한 블로그 시스템을 구축하는 프로젝트를 WBS로 관리해보겠습니다. 이 프로젝트는 3개의 Job으로 구성됩니다.

### 1단계: 프로젝트 생성

먼저 WBS 프로젝트를 생성합니다.

```bash
node skills/wbs/wbs.js create "블로그 시스템 구축"
```

**출력 예시:**
```json
{
  "id": "wbs-1",
  "title": "블로그 시스템 구축",
  "detailPath": "skills/wbs/details/wbs-1-detail.md"
}
```

프로젝트가 생성되면 자동으로 `skills/wbs/details/wbs-1-detail.md` 파일이 생성됩니다. 이 파일을 편집하여 프로젝트의 상세 요구사항을 작성합니다.

**details/wbs-1-detail.md 예시:**
```markdown
# 블로그 시스템 구축

## 개요

사용자가 글을 작성하고, 읽고, 댓글을 달 수 있는 간단한 블로그 시스템을 구축합니다.

## 요구사항

### 기능 요구사항
1. 글 작성/조회/수정/삭제 (CRUD)
2. 댓글 작성/조회
3. 사용자 인증 (로그인/로그아웃)
4. 마크다운 지원

### 기술 스택
- Backend: Node.js + Express
- Database: SQLite
- Frontend: React
- Auth: JWT

## 참고 자료

- [Express 공식 문서](https://expressjs.com/)
- [React 공식 문서](https://react.dev/)
```

### 2단계: Job 추가

프로젝트를 3개의 30분 단위 작업으로 분해합니다.

#### Job 1: 데이터베이스 스키마 설계 및 모델 작성

```bash
node skills/wbs/wbs.js job add wbs-1 \
  --title "데이터베이스 스키마 설계 및 모델 작성" \
  --agent "@claude:sonnet" \
  --seq 1 \
  --desc "SQLite 데이터베이스 스키마를 설계하고 Sequelize 모델을 작성합니다. User, Post, Comment 테이블을 포함해야 합니다."
```

#### Job 2: REST API 엔드포인트 구현

```bash
node skills/wbs/wbs.js job add wbs-1 \
  --title "REST API 엔드포인트 구현" \
  --agent "@copilot" \
  --seq 2 \
  --desc "Express.js를 사용하여 게시글 및 댓글 CRUD API를 구현합니다. JWT 인증 미들웨어를 포함합니다."
```

#### Job 3: 프론트엔드 컴포넌트 작성

```bash
node skills/wbs/wbs.js job add wbs-1 \
  --title "프론트엔드 컴포넌트 작성" \
  --agent "@claude:sonnet" \
  --seq 3 \
  --desc "React를 사용하여 게시글 목록, 상세보기, 작성 폼 컴포넌트를 작성합니다. API와 연동합니다."
```

### 3단계: 프로젝트 상태 확인

추가된 Job들을 확인합니다.

```bash
node skills/wbs/wbs.js status wbs-1
```

**출력 예시:**
```
📋 블로그 시스템 구축 (wbs-1)
   Status: planning | Progress: 0% (0/3)
   Detail: skills/wbs/details/wbs-1-detail.md

   Jobs:
   | 상태 | #  | ID     | 작업명                          | 담당           |
   |------|----|---------|---------------------------------|----------------|
   | ⬜️  | 1  | job-1  | 데이터베이스 스키마 설계 및 모델 작성 | @claude:sonnet |
   | ⬜️  | 2  | job-2  | REST API 엔드포인트 구현         | @copilot       |
   | ⬜️  | 3  | job-3  | 프론트엔드 컴포넌트 작성         | @claude:sonnet |
```

### 4단계: Job 실행

#### 방법 1: 개별 Job 실행

다음 Job을 하나씩 실행합니다.

```bash
node skills/wbs/wbs.js job next wbs-1
```

실행 중에는 다음과 같은 정보가 표시됩니다:

```
[WBS] Running job: 데이터베이스 스키마 설계 및 모델 작성
[WBS] Agent: @claude:sonnet
[WBS] Description: SQLite 데이터베이스 스키마를 설계하고 Sequelize 모델을 작성합니다...
[WBS] Detail: skills/wbs/details/wbs-1-detail.md
[WBS] Timeout: 30 minutes
[WBS] Execution ID: exec-1
[WBS] PID: 12345
──────────────────────────────────────────────────
```

#### 방법 2: 모든 Job 순차 실행

전체 Job을 한 번에 실행할 수도 있습니다.

```bash
node skills/wbs/wbs.js job run wbs-1
```

**출력 예시:**
```
══════════════════════════════════════════════════
[WBS] Starting project: 블로그 시스템 구축
══════════════════════════════════════════════════

[WBS] Running job: 데이터베이스 스키마 설계 및 모델 작성
[WBS] Agent: @claude:sonnet
[WBS] Job completed: 데이터베이스 스키마 설계 및 모델 작성
──────────────────────────────────────────────────
[WBS] Running job: REST API 엔드포인트 구현
[WBS] Agent: @copilot
[WBS] Job completed: REST API 엔드포인트 구현
──────────────────────────────────────────────────
[WBS] Running job: 프론트엔드 컴포넌트 작성
[WBS] Agent: @claude:sonnet
[WBS] Job completed: 프론트엔드 컴포넌트 작성
──────────────────────────────────────────────────

══════════════════════════════════════════════════
[WBS] Project completed: 블로그 시스템 구축
[WBS] Completed: 3, Failed: 0
══════════════════════════════════════════════════
```

### 5단계: 실행 이력 확인

각 Job의 실행 이력을 확인할 수 있습니다.

```bash
node skills/wbs/wbs.js exec list job-1
```

**출력 예시:**
```
📋 Executions for job-1

| 상태 | ID               | PID   | 시작                | 종료                | 코드 |
|------|------------------|-------|---------------------|---------------------|------|
| ✅   | exec-1           | 12345 | 2025-01-15 14:30:00 | 2025-01-15 14:55:00 | 0    |
```

특정 실행의 상세 정보도 확인할 수 있습니다.

```bash
node skills/wbs/wbs.js exec status exec-1
```

### 6단계: 실패한 Job 재실행

만약 Job이 실패했다면, 재실행할 수 있습니다.

```bash
node skills/wbs/wbs.js job retry job-2
```

## 자연어 인터페이스 사용

WBS 시스템은 자연어 명령어도 지원합니다.

### 상태 확인

```bash
node skills/wbs/wbs.js q "wbs-1 진행 상황 어때?"
```

### 작업 요청

```bash
node skills/wbs/wbs.js x "wbs-1의 실패한 작업들 재실행해줘"
```

### AI 플래닝

복잡한 작업을 AI에게 계획하도록 요청할 수 있습니다.

```bash
node skills/wbs/wbs.js plan "사용자 프로필 편집 기능 추가"
```

플래닝 세션은 30분 동안 유지되며, 같은 세션 내에서 대화를 이어갈 수 있습니다.

```bash
# 첫 번째 요청
node skills/wbs/wbs.js plan "인증 시스템 구현"

# 같은 세션에서 추가 요청 (30분 이내)
node skills/wbs/wbs.js plan "소셜 로그인도 추가해줘"

# 새 세션 시작
node skills/wbs/wbs.js plan "결제 시스템 구현" --new
```

## 고급 기능

### GitHub Issue 연동

Job을 GitHub Issue와 연동할 수 있습니다.

```bash
node skills/wbs/wbs.js job add wbs-1 \
  --title "버그 수정: 댓글 삭제 안됨" \
  --agent "@claude:sonnet" \
  --seq 4 \
  --issue 123
```

Issue 번호가 있는 Job은 실행 시 자동으로 Issue 정보를 참조하고, 완료 후 결과를 코멘트로 남깁니다.

### 백그라운드 데몬

WBS 데몬을 실행하면 자동으로 작업을 관리합니다.

```bash
# 데몬 시작
node skills/wbs/wbs.js daemon start

# 데몬 상태 확인
node skills/wbs/wbs.js daemon status

# 데몬 중지
node skills/wbs/wbs.js daemon stop
```

데몬은 5분마다:
1. 좀비 프로세스 감지 및 정리 (30분 이상 실행 중이거나 프로세스가 죽은 경우)
2. 대기 중인 Job 자동 실행

### 실행 중인 Job 강제 종료

```bash
# 실행 중인 모든 Job 확인
node skills/wbs/wbs.js exec running

# 특정 실행 강제 종료
node skills/wbs/wbs.js exec kill exec-5
```

## JSON 출력

모든 명령어는 `--json` 플래그를 사용하여 JSON 형식으로 출력할 수 있습니다. 이는 스크립트 자동화에 유용합니다.

```bash
# JSON 형식으로 프로젝트 목록 출력
node skills/wbs/wbs.js list --json

# JSON 형식으로 상태 확인
node skills/wbs/wbs.js status wbs-1 --json

# JSON 형식으로 Job 목록 출력
node skills/wbs/wbs.js job list wbs-1 --json
```

## 프로젝트 관리 팁

### 1. 30분 타임박싱 준수

각 Job은 15-45분 사이로 설계해야 합니다. 너무 큰 작업은 여러 Job으로 분할하세요.

**나쁜 예:**
```
Job 1: "전체 블로그 시스템 구현" (예상 5시간)
```

**좋은 예:**
```
Job 1: "User 모델 및 인증 API 구현" (30분)
Job 2: "Post CRUD API 구현" (30분)
Job 3: "Comment API 구현" (25분)
Job 4: "프론트엔드 기본 레이아웃" (30분)
...
```

### 2. 상세 문서 활용

`details/` 디렉토리의 상세 문서를 작성하면, 모든 Job 실행 시 자동으로 컨텍스트가 포함됩니다. 프로젝트의 전체 그림을 여기에 작성하세요.

### 3. 적절한 Agent 선택

- `@claude:sonnet`: 복잡한 로직, 아키텍처 설계
- `@claude:opus`: 매우 복잡한 문제 해결
- `@claude:haiku`: 간단한 작업
- `@copilot`: 코드 구현, 테스트 작성
- `@gemini`: 데이터 분석, 최적화

### 4. 진행 상황 모니터링

정기적으로 상태를 확인하세요.

```bash
# 간단한 체크
node skills/wbs/wbs.js list

# 상세 체크
node skills/wbs/wbs.js status wbs-1
```

## 다음 단계

이 예제를 참고하여 자신만의 프로젝트를 WBS로 관리해보세요. 더 많은 정보는 다음 문서를 참조하세요:

- [SKILL.md](./SKILL.md) - WBS 스킬 전체 문서
- [COMMANDS.md](./COMMANDS.md) - 명령어 레퍼런스
- [DESIGN.md](./DESIGN.md) - 아키텍처 설계 문서
