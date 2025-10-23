[← WBS 개요](../wbs.md)

# WBS-4: 테스트·QA 재편 작업 계획 (초안)

## 목표
- SDK와 CLI 패키지별 독립적인 테스트 환경 구축
- 단위 테스트와 통합 테스트 분리
- 테스트 커버리지 80% 이상 달성
- CI에서 자동 테스트 실행

## 선행 조건
- [x] WBS-1: 워크스페이스 구조 완료
- [ ] WBS-2: SDK 패키지 분리 (Phase 3 이상 진행)
- [x] WBS-3: CLI 패키지 정리 완료

## Phase 1: 테스트 인프라 설정 (Day 1)

### 1.1 현재 테스트 파일 조사
- [x] `tests/` 디렉토리 파일 목록 확인
- [x] 테스트 유형 분류 (단위/통합/E2E)
- [x] SDK vs CLI 테스트 분류

### 1.2 테스트 도구 설정
- [x] 루트 vitest.config.ts 업데이트
- [x] packages/sdk/vitest.config.ts 생성
- [x] packages/cli/vitest.config.ts 생성
- [x] 테스트 스크립트 추가

## Phase 2: SDK 테스트 이동 (Day 2)

### 2.1 SDK 단위 테스트
```
packages/sdk/tests/
├── unit/
│   ├── providers/
│   ├── services/
│   └── utils/
├── fixtures/
└── mocks/
```

### 2.2 테스트 파일 이동
- [x] Provider 테스트 이동
- [x] Service 테스트 이동
- [x] Utils 테스트 이동
- [x] Mock 데이터 정리

## Phase 3: CLI 테스트 구성 (Day 3)

### 3.1 CLI 테스트 구조
```
packages/cli/tests/
├── unit/
│   ├── handlers/
│   └── services/
├── integration/
│   ├── commands/
│   └── slack/
└── e2e/
```

### 3.2 통합 테스트
- [x] CLI 명령어 테스트
- [x] Slack 통합 테스트
- [x] MCP 프로토콜 테스트

## Phase 4: 테스트 커버리지 (Day 4)

### 4.1 커버리지 설정
- [x] nyc/c8 설정
- [x] 커버리지 리포트 설정
- [x] 커버리지 임계값 설정 (80%)

### 4.2 누락 테스트 작성
- [x] 커버리지 리포트 분석
- [x] 핵심 로직 테스트 추가
- [x] Edge case 테스트 추가

## Phase 5: CI 통합 (Day 5)

### 5.1 GitHub Actions
- [x] 테스트 workflow 작성
- [x] 패키지별 병렬 실행
- [x] 커버리지 리포트 업로드

### 5.2 PR 체크
- [x] 테스트 통과 필수
- [x] 커버리지 감소 방지
- [ ] 성능 테스트 (선택, 추후 확장)

## 체크포인트
- [x] Day 1: 테스트 인프라 구축
- [x] Day 2: SDK 테스트 100% 이동
- [x] Day 3: CLI 테스트 정리
- [x] Day 4: 커버리지 80% 달성
- [x] Day 5: CI 자동화 완료

## 리스크 관리
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 기존 테스트 깨짐 | 높음 | 점진적 이동, 백업 유지 |
| 순환 의존성 | 중간 | Mock 전략 수립 |
| 느린 테스트 실행 | 낮음 | 병렬 실행, 선택적 실행 |

## 성공 지표
- [x] 모든 테스트 통과
- [x] SDK 커버리지 80% 이상
- [x] CLI 커버리지 70% 이상
- [ ] CI 실행 시간 5분 이내 (첫 CI 실행에서 측정 예정)
- [x] 테스트 문서 완성

## 산출물
- 테스트 설정 파일들
- 테스트 실행 스크립트
- CI workflow 파일
- 테스트 가이드 문서
