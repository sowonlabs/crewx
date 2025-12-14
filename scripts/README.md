# CrewX Scripts

이 디렉토리는 CrewX 개발 프로세스를 자동화하는 스크립트들을 포함합니다.

## rc-test-incremental.sh

RC(Release Candidate) 버전의 점진적 테스트 스크립트입니다.

### 특징

- **CrewX 내장 병렬 처리**: `crewx execute`의 네이티브 병렬 실행 기능 활용
- **배치 처리**: N개씩 묶어서 병렬 실행 (타임아웃 방지)
- **AI 검증**: crewx_dev:haiku로 효율적인 결과 검증
- **간결한 구조**: 쉘 스크립트 복잡도 최소화

### 사용법

```bash
# 기본 사용법 (2개씩 배치)
./scripts/rc-test-incremental.sh 0.3.16-rc.1

# 3개씩 배치로 실행
./scripts/rc-test-incremental.sh 0.3.16-rc.1 --batch 3

# 환경변수로 설정
BATCH_SIZE=4 ./scripts/rc-test-incremental.sh 0.3.16-rc.1
```

### 배치 크기 설정

`--batch N` 또는 `BATCH_SIZE` 환경변수로 한 번에 실행할 테스트 개수 조절:

- `1`: 순차 실행 (가장 안전, 느림)
- `2` (기본값): 2개씩 배치 (균형)
- `3-4`: 3-4개씩 배치 (빠름, 리소스 필요)

**내부 동작:**
각 배치에서 `crewx execute "@agent task1" "@agent task2" ...` 형태로 실행되어 CrewX가 자동으로 병렬 처리

**권장 설정:**
- 개발 환경: `--batch 2`
- 강력한 머신: `--batch 3-4`
- 안정성 우선: `--batch 1`

### 커스터마이징

스크립트 내부의 `BUGS` 배열을 수정하여 테스트할 버그 목록을 변경:

```bash
BUGS=(
  "bug-00000027:TypeScript build verification with Ajv v8 types"
  "bug-00000026:md-to-slack newline fix"
  "bug-00000024:crewx.yaml file loading"
)
```

### 출력

- **개별 리포트**: `reports/bugs/bug-XXXXX-test-*.md`
- **최종 보고서**: `reports/releases/{version}/qa-report-final.md`

### 프로세스

1. **Stage 1**: 개별 버그 테스트
   - 각 버그마다 `@crewx_tester`에게 개별 테스트 요청
   - Haiku로 테스트 결과(PASS/FAIL) 검증
   - GitHub Issues 상태 확인 (`gh issue view`)
   - 성공/실패 카운트

2. **Stage 2**: 최종 보고서
   - 개발팀장(`@crewx_dev`)에게 통합 보고서 작성 요청
   - 개별 리포트 요약 및 전체 결과 정리

### Exit Codes

- `0`: 모든 테스트 성공
- `1`: 일부 테스트 실패 또는 에러 발생

### 예시 출력

```
╔═══════════════════════════════════════════════════════════╗
║   RC 0.3.16-rc.1 Incremental Testing                    ║
╚═══════════════════════════════════════════════════════════╝

📋 Testing 3 bugs sequentially...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing: bug-00000027
📝 Description: TypeScript build verification with Ajv v8 types
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ Running tester...
✅ Tester execution completed

🤖 Verifying test results with AI (using Haiku for efficiency)...
📊 Test Result: PASS

🔍 Checking GitHub Issues status with gh issue...
✅ bug-00000027: PASSED

...

╔═══════════════════════════════════════════════════════════╗
║   Stage 1 Completed: Individual Bug Tests                ║
╚═══════════════════════════════════════════════════════════╝

📊 Test Summary:
   ✅ Passed: 2
   ❌ Failed: 1
   📝 Total:  3
```

## create-pr.sh

자동 PR 생성 및 리뷰어 할당 스크립트입니다.

### 특징

- **자동 PR 생성**: Feature 브랜치에서 타겟 브랜치로 PR 생성
- **리뷰어 자동 할당**: Worker 에이전트에 따라 크로스 리뷰어 자동 선택
- **GitHub 연동**: Issue 레이블 및 코멘트 자동 추가
- **검증**: 브랜치 이름 규칙 및 이슈 번호 확인

### 사용법

```bash
# 기본 사용법 (develop 브랜치로 PR)
./scripts/create-pr.sh <issue-number>

# 특정 브랜치로 PR (예: release 브랜치)
./scripts/create-pr.sh <issue-number> <target-branch>

# 예시
./scripts/create-pr.sh 12 release/0.7.8
```

### 자동 리뷰어 할당 규칙

| Worker Agent | Reviewer Agent |
|--------------|----------------|
| @crewx_claude_dev | @crewx_gemini_dev |
| @crewx_gemini_dev | @crewx_claude_dev |
| @crewx_codex_dev | @crewx_claude_dev |

### 전제 조건

1. Feature 브랜치에서 실행 (`feature/<number>-<description>`)
2. 변경사항이 커밋되어 있어야 함
3. GitHub CLI (`gh`) 설치 및 인증 완료
4. Issue에 `worker:<agent-name>` 레이블 설정

### 프로세스

1. 현재 브랜치 검증 (feature/ 접두사 확인)
2. Issue 정보 조회 (제목, 레이블)
3. Worker 레이블 기반 리뷰어 결정
4. 브랜치를 origin에 푸시
5. PR 생성 (자동 생성된 본문 포함)
6. Issue에 `reviewer:<agent-name>` 레이블 추가
7. Issue에 PR 링크 코멘트 추가

### 출력 예시

```
📋 Fetching issue #12 details...
🚀 Pushing feature/12-fix-auth-bug to origin...
📝 Creating PR to release/0.7.8...
✅ PR created: https://github.com/sowonlabs/crewx/pull/13
🏷️  Adding reviewer label to issue...
💬 Adding PR link to issue...

🎉 Done! PR workflow initiated for issue #12
PR: https://github.com/sowonlabs/crewx/pull/13
Reviewer: @crewx_gemini_dev
```

### 에러 처리

- ❌ Issue 번호 누락: 사용법 출력
- ❌ Feature 브랜치가 아님: 에러 메시지 및 종료
- ⚠️ 브랜치 이슈 번호 불일치: 확인 후 진행

## 관련 문서

- [개발 프로세스](../docs/development.md)
- [버그 관리](../bug.md)
- [에이전트 설정](../agents.yaml)
