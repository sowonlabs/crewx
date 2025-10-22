[← WBS 개요](../wbs.md)

# WBS-7: 운영·거버넌스 준비 작업 계획 (초안)

## 목표
- 오픈소스 프로젝트 거버넌스 체계 구축
- 기여자 관리 및 CLA 프로세스 수립
- 버전 정책 및 릴리즈 주기 확립
- 커뮤니티 가이드라인 제정

## 선행 조건
- [x] WBS-1: 기본 구조 (필수)
- [ ] WBS-2, WBS-3: 상세 구조 파악 (권장)

## Phase 1: 라이선스 및 법적 체계 (Day 1)

### 1.1 라이선스 정책
- [ ] 듀얼 라이선스 전략 확정
  - CLI: MIT License
  - SDK: Apache-2.0 + CLA
- [ ] LICENSE 파일 배치
  - 루트: 전체 프로젝트 라이선스
  - packages/cli/LICENSE: MIT
  - packages/sdk/LICENSE: Apache-2.0

### 1.2 CLA (Contributor License Agreement)
- [ ] CLA 문서 작성
- [ ] CLA Assistant 설정
  ```yaml
  # .github/cla.yml
  - Individual CLA
  - Corporate CLA
  ```
- [ ] 자동화 프로세스 구축

## Phase 2: 버전 관리 정책 (Day 2)

### 2.1 Semantic Versioning
```
MAJOR.MINOR.PATCH
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes
```

### 2.2 릴리즈 주기
- [ ] 정기 릴리즈 일정
  - Patch: 필요시 즉시
  - Minor: 월 1회
  - Major: 분기 1회
- [ ] LTS (Long Term Support) 정책
  - LTS 버전 선정 기준
  - 지원 기간 (예: 1년)

### 2.3 Deprecation Policy
- [ ] Deprecation 공지 기간 (최소 2 minor 버전)
- [ ] Migration 가이드 제공
- [ ] Breaking change 관리

## Phase 3: 기여 프로세스 (Day 3)

### 3.1 CONTRIBUTING.md
```markdown
# 기여 가이드
1. 이슈 생성 및 논의
2. Fork & Branch
3. 코드 작성 및 테스트
4. PR 제출
5. 코드 리뷰
6. 머지
```

### 3.2 이슈/PR 템플릿
- [ ] .github/ISSUE_TEMPLATE/
  - bug_report.md
  - feature_request.md
  - question.md
- [ ] .github/pull_request_template.md

### 3.3 코드 리뷰 정책
- [ ] 리뷰어 자동 할당
- [ ] 승인 요구 사항 (최소 1명)
- [ ] 테스트 통과 필수
- [ ] 리뷰 체크리스트

## Phase 4: 커뮤니티 가이드라인 (Day 4)

### 4.1 Code of Conduct
- [ ] 행동 강령 작성
- [ ] 위반 시 처리 절차
- [ ] 신고 채널

### 4.2 커뮤니케이션 채널
- [ ] GitHub Discussions 설정
- [ ] Discord/Slack 커뮤니티
- [ ] 정기 미팅/업데이트

### 4.3 인정 시스템
- [ ] Contributors 인정
  - CONTRIBUTORS.md
  - All Contributors 봇
- [ ] 기여 레벨 및 뱃지

## Phase 5: 품질 관리 (Day 5)

### 5.1 코드 품질 기준
- [ ] 코딩 스타일 가이드
  - ESLint 규칙
  - Prettier 설정
  - 네이밍 컨벤션
- [ ] 테스트 요구사항
  - 최소 커버리지 80%
  - 필수 테스트 유형

### 5.2 보안 정책
- [ ] SECURITY.md
  - 보안 취약점 보고
  - 보안 패치 프로세스
  - CVE 관리
- [ ] 의존성 관리
  - Dependabot 설정
  - 보안 감사

## Phase 6: 프로젝트 관리 (Day 6)

### 6.1 로드맵
- [ ] 단기 목표 (3개월)
- [ ] 중기 목표 (6개월)
- [ ] 장기 비전 (1년)
- [ ] 마일스톤 관리

### 6.2 메트릭 및 모니터링
- [ ] 프로젝트 건강도
  - 이슈 처리 시간
  - PR 머지 시간
  - 커뮤니티 활성도
- [ ] 사용 통계
  - npm 다운로드
  - GitHub 스타
  - 활성 사용자

### 6.3 거버넌스 구조
- [ ] 유지보수자 역할
  - Core Maintainer
  - Contributor
  - Reviewer
- [ ] 의사결정 프로세스
  - RFC (Request for Comments)
  - 투표 시스템

## 체크포인트
- [ ] Day 1: 라이선스 체계 완성
- [ ] Day 2: 버전 정책 수립
- [ ] Day 3: 기여 프로세스 구축
- [ ] Day 4: 커뮤니티 가이드 작성
- [ ] Day 5: 품질 관리 체계
- [ ] Day 6: 프로젝트 관리 시스템

## 리스크 관리
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| CLA 거부 | 높음 | 명확한 이유 설명 |
| 커뮤니티 분열 | 중간 | 투명한 소통 |
| 유지보수 부담 | 중간 | 자동화 최대화 |

## 성공 지표
- [ ] CLA 서명률 90% 이상
- [ ] 월 기여자 수 10명 이상
- [ ] 이슈 응답 시간 48시간 이내
- [ ] 코드 품질 점수 A 등급

## 산출물
- 거버넌스 문서들
  - LICENSE 파일들
  - CONTRIBUTING.md
  - CODE_OF_CONDUCT.md
  - SECURITY.md
- 프로세스 문서
  - 버전 정책
  - 릴리즈 가이드
  - 리뷰 체크리스트
- 템플릿 파일들
- CLA 문서 및 자동화
