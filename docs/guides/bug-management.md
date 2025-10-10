# CrewX 버그 관리 가이드

## 개요

CrewX 프로젝트는 **하이브리드 버그 관리 시스템**을 사용합니다:
- **주 시스템: bug.md** - 상세 문서화, AI 에이전트 협업, QA 리포트
- **보조 시스템: git-bug** - Git 네이티브 추적, 브랜치 독립적 동기화

## 버그 관리 시스템 구조

### 1. bug.md (Primary)

**위치:** `/bug.md`

**사용 목적:**
- ✅ 상세한 버그 분석 및 재현 시나리오 작성
- ✅ AI 에이전트가 직접 읽고 수정 가능
- ✅ QA 리포트 및 테스트 결과 문서화
- ✅ GitHub에서 직접 확인 가능 (가시성)
- ✅ 마크다운 형식으로 풍부한 표현

**구조:**
```markdown
## [버그 ID] 버그 제목

**ID:** bug-XXXXXXXX (또는 git-bug hash)
**우선순위:** 긴급/높음/중간/낮음
**버전:** X.X.X
**상태:** created/analyzed/in-progress/resolved/closed/rejected
**등록일:** YYYY-MM-DD
**종료일:** YYYY-MM-DD (해당 시)

### 현상
[버그 발생 현상 상세 설명]

### 재현 방법
1. [단계별 재현 방법]
2. ...

### 원인 분석
[근본 원인 분석]

### 해결 방법
[수정 방법 및 코드 변경 사항]

### 테스트
[테스트 시나리오 및 검증 방법]

### 영향 범위
[영향받는 기능 및 사용자]
```

### 2. git-bug (Secondary)

**저장 위치:** `.git/refs/bugs/`

**사용 목적:**
- ✅ Git 네이티브 추적 (커밋 연동)
- ✅ 브랜치 독립적 (모든 브랜치에서 동일한 버그 목록)
- ✅ push/pull로 팀 자동 동기화
- ✅ 해시 기반 ID (충돌 없음)
- ✅ CI/CD 파이프라인 통합

**주요 명령어:**
```bash
# 버그 목록
git bug bug

# 버그 상세 보기
git bug bug show <hash>

# 버그 상태 변경
git bug bug status close <hash>
git bug bug status open <hash>

# 라벨 관리
git bug bug label new <hash> priority:high
git bug bug label new <hash> release:0.3.11

# 코멘트 추가
git bug bug comment new <hash> "수정 완료"

# 원격 동기화
git bug push origin
git bug pull origin
```

## 워크플로우

### 버그 발견 시

#### 1단계: bug.md에 등록 (Primary)

```bash
# bug.md 파일 직접 편집
vim bug.md

# 또는 CrewX CLI 사용 (추후 구현 예정)
crewx bug create "버그 제목" --priority=high
```

#### 2단계: git-bug에 동기화

```bash
# 수동 동기화
git bug bug new --title "[bug-00000021] 버그 제목"
# 생성된 해시 ID를 bug.md에 기록

# 또는 자동 동기화 스크립트 사용
./scripts/sync-bugs.sh export
```

#### 3단계: Git 커밋

```bash
git add bug.md
git commit -m "bug: register bug-00000021 - 버그 제목

Ref: f7dd943"  # git-bug 해시 ID 참조
```

### 버그 분석 시

**AI 에이전트 활용:**
```bash
# 자동 분석 스크립트
./scripts/bug-analyzer.sh

# 또는 직접 에이전트 실행
crewx query "@crewx_dev bug-00000021 분석해줘"
crewx query "@claude bug-00000021 근본 원인 찾아줘"
```

**bug.md 업데이트:**
- 상태를 `analyzed`로 변경
- 원인 분석 섹션 작성
- 해결 방법 제안

**git-bug 업데이트:**
```bash
git bug bug comment new <hash> "원인: XXX로 분석됨"
git bug bug label new <hash> analyzed
```

### 버그 수정 시

#### 1단계: 브랜치 생성

```bash
# git-bug 해시 사용 (권장)
git checkout -b bugfix/f7dd943-oauth-session

# 또는 기존 방식
git checkout -b bugfix/bug-00000021
```

#### 2단계: 코드 수정

```bash
# 코드 수정 후 커밋
git commit -m "fix: resolve oauth session timeout issue

- OAuth 세션 만료 시간을 30분에서 1시간으로 연장
- 세션 갱신 로직 개선

Fixes: f7dd943
Closes: bug-00000021"
```

#### 3단계: bug.md 업데이트

```markdown
**상태:** resolved
**종료일:** 2025-10-05

### 해결 방법
[실제 수정 내용 작성]
```

#### 4단계: git-bug 종료

```bash
git bug bug status close f7dd943
git bug bug label new f7dd943 release:0.3.11
```

### QA 테스트 시

#### 1단계: 테스트 수행

```bash
# QA 에이전트 실행
crewx x "@crewx_tester bug-00000021 테스트해줘"
```

#### 2단계: 리포트 작성

**bug.md에 테스트 결과 추가:**
```markdown
### 테스트

**테스트일:** 2025-10-05
**테스터:** @crewx_tester

**시나리오 1:** OAuth 로그인 후 30분 대기
- ✅ 세션 유지됨

**시나리오 2:** 1시간 후 API 호출
- ✅ 자동 갱신 작동

**결과:** PASS
```

**git-bug에 결과 기록:**
```bash
git bug bug comment new f7dd943 "QA 테스트 통과 (5/5 시나리오)"
git bug bug label new f7dd943 qa-passed
```

#### 3단계: 상태 변경

```markdown
# bug.md
**상태:** closed
```

```bash
# git-bug
git bug bug status close f7dd943
```

## 동기화 전략

### bug.md → git-bug (Export)

```bash
# 자동 동기화 스크립트 사용
./scripts/sync-bugs.sh export

# 수동 동기화
# 1. bug.md에서 created 상태 버그 추출
# 2. git bug bug new로 생성
# 3. 생성된 해시를 bug.md에 기록
```

### git-bug → bug.md (Import)

```bash
# 자동 동기화 스크립트 사용
./scripts/sync-bugs.sh import

# 주간 리포트 생성
./scripts/sync-bugs.sh report > docs/weekly-bugs.md
```

### 양방향 동기화 (Sync)

```bash
# 전체 동기화
./scripts/sync-bugs.sh sync

# CI/CD에서 자동 실행 설정
# .github/workflows/sync-bugs.yml
```

### 충돌 처리 (Conflict Resolution)

동기화 중 bug.md와 git-bug 간에 데이터가 다를 경우 충돌이 발생할 수 있습니다.

#### 충돌 감지 항목

- **상태(status)** 불일치: bug.md는 `resolved`, git-bug는 `open`
- **우선순위(priority)** 불일치: bug.md는 `긴급`, git-bug는 `높음`
- **제목(title)** 불일치: 버그 제목이 서로 다름

#### 충돌 해결 전략

스크립트는 3가지 전략을 지원합니다:

**1. latest (기본값, 추천)**
```bash
./scripts/sync-bugs.sh sync
# 또는 명시적 설정
CONFLICT_STRATEGY=latest ./scripts/sync-bugs.sh sync
```
- 최신 수정 시각을 비교하여 우선순위 결정
- bug.md의 "종료일" 또는 생성일과 git-bug의 마지막 수정 시각 비교
- 더 최근에 수정된 쪽의 데이터를 우선

**2. bug-md-first (bug.md 우선)**
```bash
CONFLICT_STRATEGY=bug-md-first ./scripts/sync-bugs.sh sync
```
- bug.md를 Primary 소스로 간주
- 충돌 시 항상 bug.md의 데이터로 git-bug 덮어쓰기
- bug.md가 항상 정확한 경우 사용

**3. manual (수동 확인)**
```bash
CONFLICT_STRATEGY=manual ./scripts/sync-bugs.sh sync
```
- 충돌 발견 시 사용자에게 알림
- `.crewx/conflicts.log`에 상세 기록
- 계속 진행 여부를 사용자에게 물어봄

#### 충돌 로그 확인

```bash
# 충돌 이력 확인
cat .crewx/conflicts.log

# 충돌 로그 예시
[2025-10-05 19:30:00] CONFLICT: bug-00000001: Conflicts detected in [status,priority]
[2025-10-05 19:30:00] CONFLICT:   - bug.md: status=resolved, priority=긴급, title=OAuth 세션 타임아웃, updated=2025-10-05
[2025-10-05 19:30:00] CONFLICT:   - git-bug: status=open, priority=높음, updated=2025-10-04
[2025-10-05 19:30:00] CONFLICT:   - Resolution: bug.md (latest: 2025-10-05)
```

#### 충돌 해결 워크플로우

```bash
# 1. 동기화 실행 (latest 전략)
./scripts/sync-bugs.sh sync

# 2. 충돌 로그 확인
cat .crewx/conflicts.log

# 3. 필요 시 수동 확인 모드로 재실행
CONFLICT_STRATEGY=manual ./scripts/sync-bugs.sh sync

# 4. 특정 버그만 수동 수정
vim bug.md  # 또는 git bug bug edit <hash>

# 5. 재동기화
./scripts/sync-bugs.sh sync
```

#### 충돌 예방 베스트 프랙티스

1. **단일 소스 원칙**: bug.md를 주 소스로 사용
   - AI 에이전트는 bug.md만 수정
   - git-bug는 추적 및 자동화용

2. **정기 동기화**: 충돌 누적 방지
   ```bash
   # cron 설정 (매일 자정)
   0 0 * * * cd /path/to/crewx && ./scripts/sync-bugs.sh sync
   ```

3. **동기화 전 확인**: 변경 전 현재 상태 확인
   ```bash
   # bug.md 상태
   grep "^상태:" bug.md | sort | uniq -c

   # git-bug 상태
   git bug bug --format json | jq -r '.[].status' | sort | uniq -c
   ```

4. **롤백 준비**: 동기화 전 백업
   ```bash
   cp bug.md bug.md.backup
   git bug bug --format json > bugs-backup.json
   ```

## 릴리즈 프로세스

### 릴리즈 준비

```bash
# 1. 해당 릴리즈 버그 확인
git bug bug --label release:0.3.11 --status open

# 2. Critical 버그 체크
CRITICAL=$(git bug bug --label critical --status open | wc -l)
if [ "$CRITICAL" -gt 0 ]; then
  echo "❌ Critical bugs must be resolved before release"
  exit 1
fi

# 3. 릴리즈 노트 생성
git bug bug --label release:0.3.11 --status closed > release-notes-bugs.txt
```

### 릴리즈 노트 작성

**bug.md 기반:**
```bash
# bug.md에서 resolved/closed 버그 추출
awk '/^##.*bug-/ {print}' bug.md | grep "0.3.11"
```

**git-bug 기반:**
```bash
git bug bug --label release:0.3.11 --status closed --format json | \
  jq -r '.[] | "- [\(.id[:7])] \(.title)"'
```

## 도구 및 자동화

### scripts/sync-bugs.sh

버그 데이터 양방향 동기화 스크립트

```bash
./scripts/sync-bugs.sh export  # bug.md → git-bug
./scripts/sync-bugs.sh import  # git-bug → bug.md
./scripts/sync-bugs.sh sync    # 양방향 동기화
./scripts/sync-bugs.sh report  # 주간 리포트
```

### scripts/bug-analyzer.sh

created 상태 버그 자동 분석

```bash
# 백그라운드 실행
./scripts/bug-analyzer.sh &

# 설정
ANALYZER_AGENT="crewx_dev"  # 분석 에이전트
CHECK_INTERVAL=60              # 체크 간격 (초)
```

### CI/CD 통합

```yaml
# .github/workflows/bugs.yml
name: Bug Sync
on:
  push:
    branches: [develop, main]
    paths: ['bug.md']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Install git-bug
        run: |
          wget https://github.com/MichaelMure/git-bug/releases/download/v0.8.0/git-bug_linux_amd64
          sudo mv git-bug_linux_amd64 /usr/local/bin/git-bug
          chmod +x /usr/local/bin/git-bug
      
      - name: Sync bugs
        run: ./scripts/sync-bugs.sh sync
      
      - name: Push changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add bug.md
          git commit -m "chore: sync bug.md with git-bug" || true
          git bug push origin
```

## 베스트 프랙티스

### 1. bug.md를 소스로 사용

- ✅ 새 버그는 항상 bug.md에 먼저 작성
- ✅ AI 에이전트가 bug.md를 직접 수정
- ✅ 상세한 분석과 재현 시나리오 포함

### 2. git-bug는 추적용

- ✅ bug.md 작성 후 git-bug에 동기화
- ✅ 브랜치 간 버그 상태 공유
- ✅ 커밋 메시지에 `Fixes: <hash>` 참조

### 3. ID 관리

- bug.md: `bug-XXXXXXXX` (시퀀셜 ID, 가독성)
- git-bug: `f7dd943` (해시 ID, 충돌 없음)
- 둘 다 bug.md에 기록: `**ID:** bug-00000021 (git-bug: f7dd943)`

### 4. 라벨 활용

```bash
# 우선순위
git bug bug label new <id> priority:critical
git bug bug label new <id> priority:high
git bug bug label new <id> priority:medium
git bug bug label new <id> priority:low

# 릴리즈
git bug bug label new <id> release:0.3.11

# 상태
git bug bug label new <id> analyzed
git bug bug label new <id> qa-passed
git bug bug label new <id> hotfix
```

### 5. 커밋 메시지 규칙

```bash
# 버그 수정 커밋
git commit -m "fix: resolve oauth timeout

Fixes: f7dd943
Closes: bug-00000021"

# 버그 등록 커밋
git commit -m "bug: register memory leak issue

Ref: 68339db"
```

## 문제 해결

### bug.md와 git-bug 불일치

```bash
# 동기화 스크립트로 해결
./scripts/sync-bugs.sh sync

# 충돌 로그 확인
cat .crewx/conflicts.log

# 수동 확인
diff <(awk '/^## \[bug-/ {print $2}' bug.md | tr -d '[]') \
     <(git bug bug --format json | jq -r '.[].title' | grep -o 'bug-[0-9]*')
```

### 충돌 발생 시 대응 절차

**1. 충돌 로그 분석**
```bash
# 최근 충돌 확인
tail -20 .crewx/conflicts.log

# 특정 버그 충돌 이력
grep "bug-00000001" .crewx/conflicts.log
```

**2. 데이터 확인**
```bash
# bug.md 데이터
grep -A 10 "^ID: bug-00000001" bug.md

# git-bug 데이터
git bug bug show <hash>
```

**3. 올바른 데이터 결정**
- 최신 수정 확인: 어느 쪽이 더 최근에 업데이트되었는가?
- 신뢰할 수 있는 소스: 어느 시스템의 데이터가 더 정확한가?
- 변경 이력: Git 커밋 히스토리 확인

**4. 수동 수정**
```bash
# bug.md가 정확한 경우
CONFLICT_STRATEGY=bug-md-first ./scripts/sync-bugs.sh export

# git-bug가 정확한 경우 (bug.md 수동 수정 후)
vim bug.md
./scripts/sync-bugs.sh sync
```

### git-bug 데이터 백업

```bash
# JSON 백업
git bug bug --format json > bugs-backup.json

# 복원 스크립트
./scripts/restore-bugs.sh bugs-backup.json
```

### 팀원 git-bug 설치

```bash
# macOS
brew install git-bug

# Linux
wget https://github.com/MichaelMure/git-bug/releases/download/v0.8.0/git-bug_linux_amd64
sudo mv git-bug_linux_amd64 /usr/local/bin/git-bug
chmod +x /usr/local/bin/git-bug

# 초기 설정
git bug user new
git bug user adopt <user-id>
```

## 참고 자료

- [git-bug 공식 문서](https://github.com/MichaelMure/git-bug)
- [bug.md 템플릿](../../bug.md)
- [버그 분석 스크립트](../../scripts/bug-analyzer.sh)
- [동기화 스크립트](../../scripts/sync-bugs.sh)

## 업데이트 이력

- 2025-10-05: 충돌 처리 섹션 추가 (latest/bug-md-first/manual 전략)
- 2025-10-05: 하이브리드 시스템 가이드 초안 작성
