# SowonAI CrewX 개발 프로세스

**Version:** 1.0 (Draft)  
**Last Updated:** 2025-10-05  
**Owner:** Development Team Lead (GitHub Copilot)

---

## 📋 목차
1. [개요](#개요)
2. [버그 워크플로우](#버그-워크플로우)
3. [브랜치 전략](#브랜치-전략)
4. [에이전트 협업](#에이전트-협업)
5. [통합 검증 프로세스](#통합-검증-프로세스)
6. [릴리스 프로세스](#릴리스-프로세스)

---

## 개요

SowonAI CrewX는 AI 에이전트 협업 기반 개발을 지향합니다.
- **개발팀장**: GitHub Copilot (작업 분배, 조율, 의사결정)
- **개발자 에이전트**: @claude, @copilot (분석, 구현)
- **테스터 에이전트**: @crewx_tester (검증)

---

## 버그 워크플로우

### 버그 상태 전이
```
created → analyzed → in-progress → resolved → closed
                                  ↓
                              rejected
```

### 상태별 설명
- **created**: 버그 최초 등록, 재현 시나리오 작성
- **analyzed**: 원인 분석 완료, 해결책 도출
- **in-progress**: 수정 작업 진행 중
- **resolved**: 수정 완료, 테스트 통과, 커밋 완료 (머지 대기)
- **closed**: develop 브랜치에 머지 완료, 릴리스 반영
- **rejected**: 수정 실패 또는 재현 불가, 재작업 필요

### bug.md 관리
- 모든 버그는 `bug.md` 파일에 등록
- ID 포맷: `bug-00000XXX` (순차 증가)
- 필수 필드: ID, 우선순위, 버전, 상태, 작성자, 작업자, 생성일, 수정일, 현상, 해결책

### 버그 작업 프로세스
1. **버그 발견** → `bug.md`에 `created` 상태로 등록
2. **분석 위임** → @claude에게 원인 분석 요청 → `analyzed`
3. **수정 위임** → @copilot에게 구현 요청 → `in-progress`
4. **검증 위임** → @crewx_tester에게 테스트 요청
5. **수정 완료** → 커밋, 상태 `resolved`
6. **머지 후** → 상태 `closed`

---

## 브랜치 전략

### 브랜치 구조
```
main (프로덕션, 항상 안정)
  ↑
develop (개발 통합)
  ↑
release/X.X.X-rc.N (릴리스 후보 통합)
  ↑
bugfix/HASH (개별 버그 수정, main 기반, HASH=git-bug 7자 해시)
feature/feature-name (기능 개발, main 기반)
hotfix/hotfix-name (긴급 수정, main 기반)
```

**브랜치 네이밍 규칙:**
- `bugfix/HASH`: 버그 수정 (**main에서 분기**, HASH는 git-bug 7자 해시)
- `feature/feature-name`: 기능 개발 (**main에서 분기**)
- `hotfix/hotfix-name`: 긴급 수정 (main에서 분기)
- `release/X.X.X-rc.N`: RC 통합 브랜치 (develop에서 분기)

**Bug ID 형식:**
- ✅ git-bug 해시 사용: `c8b3f1d` (7자)
- ❌ 슬러그 형식 사용 금지: `bug-00000027` (deprecated)

### Worktree 활용
**모든 브랜치는 Git Worktree로 생성하여 격리된 환경 제공**

#### 버그 수정 워크플로우
```bash
# 1. 버그 찾기 및 상세 확인
git bug bug --status open
git bug bug show c8b3f1d  # 7자 해시 사용

# 2. Worktree 생성 (main 기반)
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git worktree add worktree/bugfix-c8b3f1d -b bugfix/c8b3f1d main

# 3. 작업 브랜치 기록 (git-bug에 추적 정보 저장)
git bug bug comment new c8b3f1d --message "Working on: bugfix/c8b3f1d
Worktree: $(git rev-parse --show-toplevel)/worktree/bugfix-c8b3f1d"

# 4. 작업
cd worktree/bugfix-c8b3f1d
# ... 코드 수정 ...
git add .
git commit -m "fix(bug): resolve c8b3f1d - description"

# 5. git-bug 상태 업데이트
git bug bug label rm c8b3f1d status:open
git bug bug label new c8b3f1d status:resolved
git bug bug comment new c8b3f1d --message "Fixed: description"

# 5. 통합 검증 대기 (release/X.X.X-rc.N으로 통합)
```

#### 릴리스 후보(RC) 브랜치 워크플로우
```bash
# 1. RC 브랜치를 worktree로 생성 (develop 기반)
# 네이밍: release/X.X.X-rc.N (업계 표준)
git worktree add worktree/release-0.3.9-rc.2 -b release/0.3.9-rc.2 develop

# 2. 모든 resolved 버그 머지 (git-bug 해시 사용)
cd worktree/release-0.3.9-rc.2
git merge --no-ff bugfix/c8b3f1d
git merge --no-ff bugfix/a70534f
git merge --no-ff bugfix/6e4d67c
# ... (모든 resolved 버그)

# 3. 빌드 및 통합 검증
npm run build

# 4. QA팀장에게 통합 테스트 요청
# @crewx_qa_lead가 테스터들을 조율하여 병렬 테스트 수행

# 5-A. 테스트 통과 시 (PASS)
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git checkout develop
git merge --no-ff release/0.3.9-rc.2

# 버전 태그 및 npm 배포
npm version 0.3.9-rc.2
npm run build
npm publish --tag next
git push origin develop --tags

# 5-B. 테스트 실패 시 (FAIL)
# - QA 리포트 검토 (reports/qa-report-0.3.9-rc.2-FAIL.md)
# - 실패한 버그를 bug.md에서 resolved → rejected 처리
# - rc.3 생성하여 재시도 또는 실패 버그 제외
```

**핵심 원칙:**
- ✅ RC 브랜치 네이밍: `release/X.X.X-rc.N` (develop/X.X.X-rcN 대신)
- ✅ **버그/피처는 main에서 분기**: 안정 버전 기준, 혼동 방지
- ✅ RC는 통합 테스트 전용: 새 개발 금지
- ✅ 실패 시 재시도: rc.1 → rc.2 → rc.3 (부분 머지 금지)

---

## 에이전트 협업

### 에이전트 역할 정의

#### 1. GitHub Copilot (개발팀장)
**역할:**
- 작업 분해 및 todo 관리
- 에이전트 선택 및 작업 배분
- 진행 상황 모니터링
- 의사결정 및 대표님께 보고

**하지 않는 것:**
- ❌ 직접 코드 작성
- ❌ 직접 분석 수행
- ❌ 직접 테스트 실행

**도구:**
- `executeAgent` / `executeAgentParallel`
- `queryAgent` / `queryAgentParallel`
- `manage_todo_list`

#### 2. @crewx_qa_lead (QA팀장) ⭐ NEW
**Agent ID:** `crewx_qa_lead`  
**Provider:** Claude Sonnet  
**역할:**
- 테스트 계획 수립
- 테스터에게 테스트 위임
- 테스트 결과 수집 및 분석
- 통합 QA 리포트 생성
- Go/No-Go 의사결정

**활용 시나리오:**
- resolved 버그 검증 관리
- RC 브랜치 통합 테스트 조율
- 여러 버그 병렬 검증 관리

**특징:**
- 직접 테스트하지 않음 (테스터에게 위임)
- 병렬 테스트 조율 전문
- 통합 QA 리포트 작성
- development.md 이해

**워크플로우:**
```
GitHub Copilot (팀장)
    ↓ 테스트 요청
@crewx_qa_lead (QA팀장)
    ↓ 테스트 위임 (병렬)
@crewx_tester (테스터들)
    ↓ 개별 리포트
@crewx_qa_lead (QA팀장)
    ↓ 통합 리포트
GitHub Copilot (팀장)
```

#### 3. @crewx_dev (CrewX 전문 개발자)
**Agent ID:** `crewx_dev`  
**Provider:** Claude Sonnet  
**역할:**
- CrewX 프로젝트 버그 수정
- 기능 개발 및 구현
- Git worktree 워크플로우 전문
- bug.md 업데이트

**활용 시나리오:**
- CrewX 프로젝트 버그 수정
- 새 기능 구현
- 코드 품질 개선

**특징:**
- Git worktree 워크플로우 숙지
- bug.md 관리 경험
- CrewX 아키텍처 이해

#### 3. @crewx_tester (검증 전문)
**Agent ID:** `crewx_tester`  
**Provider:** Claude Sonnet  
**역할:**
- 수정 사항 검증
- 재현 시나리오 테스트
- 엣지 케이스 확인
- 테스트 리포트 작성 (reports/ 디렉토리)

**활용 시나리오:**
- resolved 버그 검증
- 통합 테스트
- 릴리스 전 QA

**특징:**
- 체계적인 테스트 시나리오 작성
- 상세한 테스트 리포트 생성
- 버그 재현 능력

#### 4. @claude (범용 분석)
**Built-in Agent**  
**역할:**
- 복잡한 버그 원인 분석
- 아키텍처 리뷰 및 설계
- 보안 취약점 분석
- 상세 문서 작성

**활용 시나리오:**
- 버그 원인을 알 수 없을 때
- 여러 요인이 복합된 문제
- 설계 결정이 필요할 때

#### 5. @copilot (범용 구현)
**Built-in Agent**  
**역할:**
- 일반적인 코드 작성
- 테스트 코드 작성
- 코드 리뷰
- Best Practice 적용

**활용 시나리오:**
- 명확한 수정 방향이 있을 때
- 빠른 구현이 필요할 때
- 범용 코드 작성

### 에이전트 선택 가이드

| 작업 유형 | 추천 에이전트 | 이유 |
|---------|-------------|------|
| CrewX 버그 수정 | @crewx_dev | Git worktree 워크플로우, bug.md 관리 |
| CrewX 기능 개발 | @crewx_dev | 프로젝트 아키텍처 이해 |
| 테스트 관리 | @crewx_qa_lead | 테스트 계획, 병렬 테스트 조율 |
| 버그 검증 | @crewx_tester | 실제 테스트 실행 (QA팀장이 위임) |
| 복잡한 분석 | @claude | 심층 분석 능력 |
| 범용 코드 작성 | @copilot | 빠른 구현 |

### 역할 계층 구조
```
대표님 (CEO/CTO)
    ↓
GitHub Copilot (개발팀장)
    ↓
    ├─ @crewx_dev (개발자) → 버그 수정/기능 개발
    ├─ @crewx_qa_lead (QA팀장) → 테스트 관리
    │    ↓
    │    └─ @crewx_tester (테스터) → 실제 테스트
    ├─ @claude (분석가) → 복잡한 분석
    └─ @copilot (구현자) → 범용 구현
```

### 병렬 처리 전략

#### 언제 병렬 처리?
1. **다중 버그 분석**: 여러 버그의 원인을 동시에 분석
2. **다각도 리뷰**: 같은 코드를 여러 관점에서 검토
3. **통합 검증**: 여러 수정사항을 동시에 테스트

#### 병렬 처리 예시
```javascript
// ❌ 비효율적 (순차)
await queryAgent("@claude", "bug-00000013 분석");
await queryAgent("@claude", "bug-00000014 분석");
await queryAgent("@claude", "bug-00000015 분석");

// ✅ 효율적 (병렬)
await queryAgentParallel([
  { agentId: "claude", query: "bug-00000013 분석" },
  { agentId: "claude", query: "bug-00000014 분석" },
  { agentId: "claude", query: "bug-00000015 분석" },
]);
```

---

## 통합 검증 프로세스

### 기존 방식 (비효율)
```
bug-00000013 수정 → 검증 → 머지
bug-00000014 수정 → 검증 → 머지
bug-00000015 수정 → 검증 → 머지
```
- ❌ 순차 처리로 시간 소요
- ❌ 버그 간 충돌 사전 감지 불가
- ❌ 병렬 처리 미활용

### 새 방식 (효율) ✅
```
모든 resolved 버그
    ↓
develop/0.3.9-rc.2 (통합 브랜치)
    ↓
병렬 검증 (모든 버그 동시 테스트)
    ↓
PASS → develop 머지
FAIL → 문제 버그 제외 후 재시도
```

### 통합 검증 워크플로우

#### 1. resolved 버그 수집
```bash
# bug.md에서 resolved 상태 버그 목록 추출
grep -B 5 "상태: resolved" bug.md | grep "^ID:"

# 결과 예시:
# ID: bug-00000013
# ID: bug-00000014
# ID: bug-00000015
# ... (총 13개)
```

#### 2. RC 브랜치 생성 및 통합
```bash
# RC 브랜치 생성 (worktree로 격리, release/ 네이밍)
git worktree add worktree/release-0.3.9-rc.2 -b release/0.3.9-rc.2 develop
cd worktree/release-0.3.9-rc.2

# 모든 resolved 버그 머지
git merge --no-ff bugfix/bug-00000013
git merge --no-ff bugfix/bug-00000014
git merge --no-ff bugfix/bug-00000015
# ... (충돌 발생 시 해결)
```

#### 3. 통합 테스트 (병렬)
```bash
# 빌드
npm run build

# QA팀장에게 통합 검증 요청
# 자동화 가능한 버그만 @crewx_tester에게 위임
# Slack Bot 관련 버그는 수동 테스트 필요

executeAgent({
  agentId: "crewx_qa_lead",
  task: `
    release/0.3.9-rc.2 브랜치의 모든 resolved 버그 통합 검증:
    - bug-00000013: STDERR 에러 처리 (자동 테스트 가능)
    - bug-00000014: Git commits 누락 처리 (자동 테스트 가능)
    - bug-00000019: Slack Bot EPIPE 에러 (⚠️ 수동 테스트 필요)

    자동화 가능한 버그는 @crewx_tester에게 병렬 테스트 위임.
    수동 테스트 필요한 버그는 테스트 시나리오 작성 후 Dev Lead에게 보고.
  `,
  projectPath: "./worktree/release-0.3.9-rc.2"  // 상대경로
});
```

**테스트 분류:**
- ✅ **자동 테스트 가능**: CLI 명령어, API 호출, 파일 처리 등
- ⚠️ **수동 테스트 필요**: Slack Bot, 브라우저 UI, 외부 서비스 연동 등

#### 4. 테스트 결과 판단 및 처리

##### 4-1. 모든 테스트 PASS ✅
```bash
# QA팀장 리포트: qa-report-0.3.9-rc.2-PASS.md
# 모든 버그 검증 통과

# 1. develop 브랜치로 머지
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git checkout develop
git merge --no-ff release/0.3.9-rc.2
git push origin develop

# 2. bug.md 업데이트
# 모든 테스트 통과한 버그: resolved → closed

# 3. RC 배포
npm version 0.3.9-rc.2
npm run build
npm publish --tag next

# 4. 다음 정식 릴리스 준비
# - main 브랜치로 머지 계획
# - 최종 검증 후 npm publish (latest 태그)
```

##### 4-2. 일부 테스트 FAIL ❌
```bash
# 예시: 3개 버그 중 1개 실패
# - bug-00000013: ✅ PASS
# - bug-00000014: ❌ FAIL (still crashes)
# - bug-00000015: ✅ PASS

# 1. QA팀장이 실패 리포트 작성
#    파일: qa-report-0.3.9-rc.2-FAIL.md
#    내용:
#      - 어떤 버그가 실패했는지
#      - 왜 실패했는지 (원인)
#      - 무엇을 수정해야 하는지
#      - 통과한 버그 목록
#      - 실패한 버그 목록 및 재작업 계획

# 2. bug.md 업데이트
#    실패한 버그: resolved → rejected
#    거부 사유 추가
#    수정일 업데이트

# 3. 개발팀장이 실패한 버그 재작업 지시
#    bug-00000014를 @crewx_dev에게 다시 할당

# 4. 다음 RC 버전 생성 (재시도)
#    release/0.3.9-rc.3 생성 (실패한 버그 제외)
#    또는 실패 버그 수정 후 다시 rc.3에 포함

# 5. rc.3 생성 및 재테스트
git worktree add worktree/release-0.3.9-rc.3 -b release/0.3.9-rc.3 develop
cd worktree/release-0.3.9-rc.3

# 통과한 버그만 머지 or 수정된 버그 포함
git merge --no-ff bugfix/bug-00000013
git merge --no-ff bugfix/bug-00000015
# bug-00000014는 제외 또는 재수정 후 포함

# 빌드 및 QA팀장에게 rc.3 테스트 요청
npm run build
# executeAgent crewx_qa_lead...
```

**핵심 원칙:**
- ❌ **부분 머지 금지**: Cherry-pick이나 선택적 머지 하지 않음
- ✅ **RC 버전 진행**: rc.1 실패 → rc.2 생성 → 재테스트
- ✅ **실패 리포트 보관**: 각 RC 버전마다 PASS/FAIL 리포트 생성
- ✅ **추적 가능성**: 릴리스 히스토리로 개선점 파악

---

## 릴리스 프로세스

### 버전 전략 (Semantic Versioning)
```
MAJOR.MINOR.PATCH-TAG
  |     |     |     |
  |     |     |     └─ rc.1, rc.2 (릴리스 후보)
  |     |     └─────── 버그 수정
  |     └─────────── 기능 추가 (하위 호환)
  └───────────────── Breaking Changes
```

### 릴리스 워크플로우

#### 1. RC 릴리스 (테스트용)
```bash
# 1. RC 브랜치를 worktree로 생성 (develop 기반)
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git worktree add worktree/release-0.3.9-rc.2 -b release/0.3.9-rc.2 develop

# 2. 통합 검증 완료된 RC 브랜치로 이동
cd worktree/release-0.3.9-rc.2

# 3. 버전 업데이트
npm version 0.3.9-rc.2

# 4. 빌드 및 배포
npm run build
npm publish --tag next --access public

# 5. Docker 이미지 빌드 및 배포 (RC 버전)
docker build -t sowonai/crewx:0.3.9-rc.2 -t sowonai/crewx:rc .
docker push sowonai/crewx:0.3.9-rc.2
docker push sowonai/crewx:rc

# 6. Docker 이미지 검증
docker pull sowonai/crewx:0.3.9-rc.2
docker run --rm sowonai/crewx:0.3.9-rc.2 --version

# 7. 브랜치 및 태그 푸시 (⚠️ 중요: 누락하면 안됨)
git push -u origin release/0.3.9-rc.2
git push origin v0.3.9-rc.2

# 8. develop 머지
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git checkout develop
git merge --no-ff release/0.3.9-rc.2
git push origin develop

# 9. 실제 환경 테스트 (Slack Bot 등)
npm install -g crewx@next
# Slack Bot 재시작하여 수동 검증

# Docker 이미지로도 테스트 가능
docker run --rm -it sowonai/crewx:rc --help
```

#### 2. 정식 릴리스
```bash
# 1. 릴리스 브랜치 생성 (⚠️ 중요: 누락하면 안됨)
cd $(git rev-parse --show-toplevel)  # 프로젝트 루트로 이동
git worktree add worktree/release-0.3.9 -b release/0.3.9 develop

# 2. 릴리스 브랜치로 이동
cd worktree/release-0.3.9

# 3. 버전 업데이트 (RC suffix 제거)
npm version 0.3.9

# 4. 빌드 및 배포
npm run build
npm publish --access public

# 5. Docker 이미지 빌드 및 배포 (프로덕션 버전)
docker build -t sowonai/crewx:0.3.9 -t sowonai/crewx:latest .
docker push sowonai/crewx:0.3.9
docker push sowonai/crewx:latest

# 6. Docker 이미지 검증
docker pull sowonai/crewx:0.3.9
docker run --rm sowonai/crewx:0.3.9 --version

# 7. 브랜치 및 태그 푸시 (⚠️ 중요: 누락하면 안됨)
git push -u origin release/0.3.9
git push origin v0.3.9

# 8. develop 브랜치 머지
cd /Users/doha/git/crewx
git checkout develop
git merge --no-ff release/0.3.9
git push origin develop

# 9. main 브랜치 머지
git checkout main
git merge --no-ff release/0.3.9
git push origin main

# 10. GitHub Release 생성
# - 릴리스 노트 작성
# - 변경사항 요약
# - 해결된 버그 목록
```

### 릴리스 체크리스트
- [ ] 모든 resolved 버그가 통합 검증 통과
- [ ] bug.md에서 모든 버그 `closed` 처리
- [ ] package.json 버전 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] npm publish 성공
- [ ] Docker 이미지 빌드 및 푸시 성공 (sowonai/crewx:VERSION, sowonai/crewx:latest)
- [ ] Docker 이미지 검증 완료 (docker run --version 테스트)
- [ ] GitHub Release 생성
- [ ] Slack Bot 업데이트 확인

---

## 문서 업데이트 규칙

- 프로세스 변경 시 이 문서 먼저 업데이트
- 변경 이력은 Git 커밋으로 관리
- 주요 변경 시 버전 번호 증가
- 대표님 승인 후 확정

---

## 참고 문서

- `bug.md`: 버그 트래킹
- `.github/copilot-instructions.md`: Copilot 역할 정의
- `agents.yaml`: 에이전트 설정
- `package.json`: 버전 관리

---

**문서 상태: 초안 (Draft)**  
**검토 필요: 대표님 피드백 대기**
