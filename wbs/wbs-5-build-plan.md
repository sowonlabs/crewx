[← WBS 개요](../wbs.md)

# WBS-5: 빌드·릴리즈 파이프라인 정비 작업 계획 (초안)

## 목표
- 패키지별 독립적인 빌드 및 배포 프로세스
- 자동화된 버전 관리 및 릴리즈
- npm 및 GitHub 릴리즈 자동화
- 개발/스테이징/프로덕션 환경 구분

## 선행 조건
- [ ] WBS-2: SDK 패키지 분리 완료
- [x] WBS-3: CLI 패키지 정리 완료
- [ ] WBS-4: 테스트 환경 구축 (선택)

## Phase 1: 빌드 시스템 정비 (Day 1)

### 1.1 패키지별 빌드 설정
- [ ] SDK 빌드 최적화
  - [ ] TypeScript 컴파일 설정
  - [ ] 번들링 전략 (rollup/esbuild)
  - [ ] Tree-shaking 설정
- [ ] CLI 빌드 최적화
  - [ ] NestJS 빌드 설정
  - [ ] 실행 파일 최적화
  - [ ] 번들 크기 최소화

### 1.2 빌드 스크립트
```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:sdk": "npm run build -w @sowonai/crewx-sdk",
    "build:cli": "npm run build -w crewx",
    "build:watch": "npm run build --workspaces -- --watch"
  }
}
```

## Phase 2: 버전 관리 시스템 (Day 2)

### 2.1 Changeset 도입
- [ ] @changesets/cli 설치 및 설정
- [ ] .changeset/config.json 구성
- [ ] 버전 정책 정의
  - SDK: Semver 엄격 준수
  - CLI: 사용자 친화적 버전

### 2.2 릴리즈 프로세스
- [ ] changeset 작성 가이드
- [ ] 버전 범프 자동화
- [ ] CHANGELOG 자동 생성

## Phase 3: npm 배포 파이프라인 (Day 3)

### 3.1 배포 준비
- [ ] npm 계정 및 조직 설정
- [ ] 패키지 메타데이터 검증
- [ ] .npmignore 최적화
- [ ] npm scripts
  ```json
  {
    "prepublishOnly": "npm run build && npm test",
    "publish:sdk": "npm publish packages/sdk",
    "publish:cli": "npm publish packages/cli"
  }
  ```

### 3.2 배포 자동화
- [ ] GitHub Actions workflow
- [ ] npm 토큰 설정
- [ ] 조건부 배포 (태그 기반)

## Phase 4: CI/CD 파이프라인 (Day 4)

### 4.1 GitHub Actions Workflows
```yaml
# .github/workflows/ci.yml
- Build & Test (PR)
- Integration Test (main)
- Release (tags)
```

### 4.2 환경별 파이프라인
- [ ] Development (feature 브랜치)
  - 빌드 검증
  - 단위 테스트
- [ ] Staging (main 브랜치)
  - 통합 테스트
  - 성능 테스트
- [ ] Production (태그)
  - 전체 테스트
  - npm 배포
  - GitHub Release

## Phase 5: 릴리즈 관리 (Day 5)

### 5.1 GitHub Releases
- [ ] 자동 릴리즈 노트 생성
- [ ] 에셋 업로드 (바이너리)
- [ ] 태그 전략

### 5.2 배포 모니터링
- [ ] npm 다운로드 통계
- [ ] 버전별 사용 현황
- [ ] 이슈 트래킹

## 체크포인트
- [ ] Day 1: 빌드 시스템 완성
- [ ] Day 2: 버전 관리 체계 구축
- [ ] Day 3: npm 배포 준비
- [ ] Day 4: CI/CD 완성
- [ ] Day 5: 첫 릴리즈 성공

## 리스크 관리
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 배포 실패 | 높음 | Dry-run, 롤백 계획 |
| 버전 충돌 | 중간 | Changeset 검증 |
| 빌드 시간 증가 | 낮음 | 캐싱, 병렬 처리 |

## 성공 지표
- [ ] 빌드 시간 3분 이내
- [ ] 자동 배포 성공률 95% 이상
- [ ] Zero-downtime 배포
- [ ] 롤백 시간 5분 이내

## 산출물
- CI/CD workflow 파일
- 배포 스크립트
- 버전 관리 정책 문서
- 릴리즈 체크리스트
