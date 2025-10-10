# CrewX Roadmap

## 개요

CrewX의 향후 개발 계획과 주요 기능 로드맵입니다.

---

## 🎯 Phase 1: AI 에이전트 레지스트리 (Q1-Q2 2025)

### 핵심 아이디어
**Nexus + Supabase 기반 AI 에이전트 마켓플레이스**

기존 npm 레지스트리 인프라를 활용하되, AI 에이전트에 특화된 메타데이터와 검색 기능을 추가합니다.

### 아키텍처

```
사용자
  ↓ (JWT)
Auth Proxy (Supabase 인증)
  ↓ (검증된 요청)
Nexus Repository
  ↓
에이전트 패키지 (.tgz)
```

**기술 스택**:
- **사용자 인증**: Supabase Auth (JWT)
- **프록시**: Nginx/Node.js (JWT 검증 + 헤더 변환)
- **레지스트리**: Nexus Repository Manager
- **메타데이터**: PostgreSQL (능력 검색, 통계)
- **CLI**: TypeScript/Node.js

### 1.1 레지스트리 인프라 (Month 1)

**목표**: Nexus + Supabase 인증 연동

#### 구현 항목
- [ ] Nexus Repository 설정
  - npm format 레포지토리 생성
  - Remote User Token 인증 활성화
  - 호스팅 + 프록시 레포지토리 구성

- [ ] Supabase 프로젝트 설정
  - 사용자 테이블 스키마
  - JWT 발급 설정
  - 이메일 인증 워크플로우

- [ ] 인증 프록시 개발
  ```typescript
  // auth-proxy 핵심 기능
  - Supabase JWT 검증
  - X-Forwarded-User 헤더 주입
  - Nexus로 프록시 (http-proxy)
  - 에러 처리 및 로깅
  ```

- [ ] 통합 테스트
  - 사용자 회원가입/로그인
  - JWT 검증 정상 동작
  - Nexus 인증 통과 확인

**산출물**:
- 실행 가능한 프록시 서버
- Nexus + Supabase 통합 문서
- 개발자 테스트 환경

### 1.2 CLI 기본 명령어 (Month 2)

**목표**: `crewx agents` 명령어 구현

#### 구현 항목
- [ ] `crewx agents init`
  - 에이전트 프로젝트 템플릿 생성
  - agent.yaml 스캐폴딩
  - tools/ 디렉토리 구조

- [ ] `crewx agents publish`
  - agent.yaml 검증
  - .tgz 패키징 (npm pack 활용)
  - Nexus 업로드 (Supabase JWT 포함)
  - 메타데이터 DB 저장

- [ ] `crewx agents install`
  - Nexus에서 패키지 다운로드
  - .crewx/agents/ 압축 해제
  - node_dependencies 설치 (npm install)
  - 도구 실행 권한 설정

- [ ] `crewx login/logout`
  - Supabase 인증 (이메일/비밀번호)
  - JWT 토큰 ~/.crewxrc 저장
  - 토큰 갱신 로직

**산출물**:
- CLI 도구 (@crewx/cli npm 패키지)
- 사용자 가이드 문서

### 1.3 에이전트 정의 표준 (Month 2)

**목표**: agent.yaml 스펙 확정

#### agent.yaml 구조
```yaml
# 기본 메타데이터
name: backend-developer
version: 1.0.0
description: "Backend API development specialist"
author: "your-email@example.com"
license: "MIT"

# 에이전트 능력 (검색 태그)
capabilities:
  - code-generation
  - api-design
  - database-migration
  - bug-fixing

# AI 설정
provider: claude
model: sonnet
system_prompt: |
  You are a backend development specialist...

# CLI 도구 (브릿지 방식)
tools:
  - name: run-tests
    command: npm test
    description: Run test suite

  - name: git-status
    command: bash tools/git-status.sh
    description: Check repository status

# Node.js 의존성 (선택적)
node_dependencies:
  eslint: "^8.0.0"
  prettier: "^3.0.0"

# 에이전트 의존성
agent_dependencies:
  "@crewx/git-ops": "^1.0.0"

# 환경 변수 요구사항
env_vars:
  - GITHUB_TOKEN
  - DATABASE_URL

# 최소 시스템 요구사항
requirements:
  node: ">=18.0.0"
  crewx: ">=0.4.0"
```

**검증 규칙**:
- [ ] 필수 필드 검증 (name, version, description)
- [ ] 버전 시맨틱 체크 (semver)
- [ ] capabilities 허용 목록
- [ ] tools 명령어 보안 검사
- [ ] 순환 의존성 체크

### 1.4 능력 기반 검색 (Month 3)

**목표**: 에이전트 발견 기능

#### 구현 항목
- [ ] 메타데이터 DB 스키마
  ```sql
  CREATE TABLE agents (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    author_id UUID REFERENCES auth.users(id),
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE agent_capabilities (
    agent_id UUID REFERENCES agents(id),
    capability VARCHAR(100),
    PRIMARY KEY (agent_id, capability)
  );

  CREATE TABLE agent_stats (
    agent_id UUID REFERENCES agents(id),
    success_rate DECIMAL(5,2),
    avg_execution_time INTEGER,
    last_updated TIMESTAMP
  );
  ```

- [ ] `crewx agents search`
  - 텍스트 검색 (name, description)
  - 능력 필터링 (`--capability backend`)
  - 정렬 (다운로드, 평점, 최신)
  - 결과 페이징

- [ ] `crewx agents show <name>`
  - 에이전트 상세 정보
  - 의존성 트리
  - 다운로드 통계
  - 사용 예시

**산출물**:
- 검색 API 엔드포인트
- CLI 검색 명령어
- 웹 UI (선택적)

### 1.5 공식 에이전트 개발 (Month 3-4)

**목표**: 10개 공식 에이전트 배포

#### 핵심 에이전트
1. **@crewx/dev** - 개발자
   - Git worktree 관리
   - 코드 수정/커밋
   - ESLint 통합

2. **@crewx/tester** - 테스터
   - 테스트 실행
   - 리포트 생성
   - 커버리지 분석

3. **@crewx/qa-lead** - QA팀장
   - 테스트 계획 수립
   - 테스터 조율
   - 릴리스 판정

4. **@crewx/release-manager** - 릴리스 매니저
   - 브랜치 관리
   - 버전 업데이트
   - npm 배포

5. **@crewx/frontend** - 프론트엔드
   - React/Vue 컴포넌트
   - Vite 통합
   - Storybook

6. **@crewx/backend** - 백엔드
   - Express/NestJS
   - Prisma/TypeORM
   - API 설계

7. **@crewx/database** - 데이터베이스
   - 마이그레이션
   - 쿼리 최적화
   - 스키마 설계

8. **@crewx/security** - 보안
   - 취약점 스캔
   - OWASP 체크
   - 시크릿 검출

9. **@crewx/devops** - DevOps
   - Docker/Kubernetes
   - CI/CD 파이프라인
   - 모니터링

10. **@crewx/docs** - 문서화
    - README 생성
    - API 문서
    - 튜토리얼

**산출물**:
- 10개 에이전트 패키지
- 각 에이전트별 문서
- 사용 예시 및 튜토리얼

### 1.6 배포 및 베타 테스트 (Month 4)

**목표**: 베타 사용자 50명 확보

#### 활동
- [ ] 퍼블릭 레지스트리 오픈
  - registry.crewx.ai 도메인
  - SSL 인증서 설정
  - CDN 연동 (선택적)

- [ ] 베타 프로그램
  - 초대 코드 시스템
  - 피드백 수집 폼
  - 주간 뉴스레터

- [ ] 문서화
  - 시작 가이드 (Getting Started)
  - CLI 레퍼런스
  - 에이전트 개발 가이드
  - 트러블슈팅

- [ ] 커뮤니티
  - GitHub Discussions
  - Discord/Slack 채널
  - 예시 프로젝트

**성공 지표**:
- 베타 사용자 50명
- 에이전트 다운로드 500회
- 커뮤니티 에이전트 5개
- NPS > 30

---

## 🚀 Phase 2: 협업 및 평가 시스템 (Q3 2025)

### 2.1 에이전트 협업 그래프 (Month 5-6)

**목표**: 에이전트 간 협업 관계 시각화

#### 기능
- [ ] 의존성 그래프
  - 에이전트 간 호출 관계
  - 워크플로우 체인
  - 순환 의존성 검출

- [ ] 협업 패턴 추천
  - "이 에이전트와 함께 자주 사용됨"
  - 성공적인 조합 제안
  - 워크플로우 템플릿

- [ ] 시각화 UI
  - D3.js/Cytoscape 그래프
  - 인터랙티브 탐색
  - 필터링 및 검색

### 2.2 실행 통계 및 평가 (Month 7-8)

**목표**: 에이전트 품질 지표

#### 수집 데이터
- [ ] 실행 로그
  - 성공/실패 횟수
  - 평균 실행 시간
  - 에러 타입 분류

- [ ] 사용자 평가
  - 별점 (1-5)
  - 리뷰 텍스트
  - 추천/비추천

- [ ] 자동 품질 측정
  - 응답 시간
  - 에러율
  - 재시도율

#### 대시보드
- [ ] 에이전트 상태 모니터링
- [ ] 인기 에이전트 랭킹
- [ ] 사용 추이 그래프

---

## 🏢 Phase 3: 엔터프라이즈 (Q4 2025)

### 3.1 Nexus 프라이빗 레지스트리 지원 (Month 9-10)

**목표**: 기업 내부 에이전트 관리

#### 기능
- [ ] Scoped Registry 라우팅
  ```yaml
  # .crewxrc
  registries:
    default: "https://registry.crewx.ai"
    scoped:
      "@mycompany": "https://nexus.company.com/crewx-private"
  ```

- [ ] 프록시 캐싱
  - 퍼블릭 에이전트 Nexus 캐시
  - 다운로드 속도 향상
  - 오프라인 사용 가능

- [ ] 접근 제어
  - 팀별 권한 관리
  - 에이전트 접근 로그
  - 감사 추적

#### 기업용 가이드
- [ ] Nexus 설정 가이드
- [ ] 방화벽 뒤 운영
- [ ] 보안 및 컴플라이언스
- [ ] 백업 및 복구

### 3.2 유료 플랜 및 마켓플레이스 (Month 11-12)

**목표**: 수익화 모델 구축

#### 무료 티어
- 퍼블릭 에이전트 무제한 사용
- 월 1,000회 실행
- 커뮤니티 지원

#### Pro 티어 ($29/월)
- 월 10,000회 실행
- 프라이빗 에이전트 무제한
- 우선 지원
- 고급 통계

#### 엔터프라이즈 (맞춤형)
- 무제한 실행
- Nexus 프라이빗 레지스트리
- 전담 지원
- SLA 보장
- 온프레미스 옵션

#### 프리미엄 에이전트
- [ ] 유료 에이전트 판매 플랫폼
- [ ] 수익 배분 (70% 개발자, 30% 플랫폼)
- [ ] 결제 시스템 (Stripe)
- [ ] 라이센스 관리

---

## 📅 타임라인 요약

| Phase | 기간 | 주요 목표 | 성공 지표 |
|-------|------|-----------|-----------|
| **Phase 1** | Q1-Q2 2025<br/>(4개월) | 레지스트리 인프라<br/>+ 공식 에이전트 | 베타 사용자 50명<br/>다운로드 500회 |
| **Phase 2** | Q3 2025<br/>(2개월) | 협업 그래프<br/>+ 평가 시스템 | 커뮤니티 에이전트 20개<br/>NPS > 40 |
| **Phase 3** | Q4 2025<br/>(2개월) | 엔터프라이즈<br/>+ 마켓플레이스 | 기업 고객 5곳<br/>퍼블릭 에이전트 100개 |

---

## 🎯 핵심 차별화 포인트

### vs npm
- **에이전트 전용**: 능력 기반 검색, 협업 그래프
- **실행 통계**: 성공률, 평균 시간, 평가
- **AI 최적화**: 프롬프트, 모델, 도구 정의

### vs GitHub Copilot Extensions
- **멀티 에이전트**: 팀 협업 워크플로우
- **CLI 통합**: 실제 도구 실행 (git, npm, docker)
- **오픈 생태계**: 누구나 배포 가능

### vs LangChain Hub
- **실행 가능**: 프롬프트만이 아닌 완전한 에이전트
- **Node 생태계**: npm 패키지 활용
- **팀 협업**: 에이전트 간 조율

---

## 🔮 미래 비전 (2026+)

### AI 에이전트 OS
- 에이전트가 에이전트를 만드는 생태계
- 자동 최적화 (프롬프트, 도구, 협업)
- 멀티 모달 지원 (이미지, 음성, 비디오)

### 산업별 전문 에이전트
- 의료: 진단, 처방, 연구
- 금융: 분석, 리스크, 컴플라이언스
- 법률: 계약 검토, 판례 분석

### 크로스 플랫폼
- VS Code Extension
- JetBrains Plugin
- Web IDE
- 모바일 앱

---

## 📊 리스크 및 완화 전략

### 기술 리스크
| 리스크 | 확률 | 완화 전략 |
|--------|------|-----------|
| Nexus 호환 이슈 | 중 | Month 1 검증 필수 |
| Supabase JWT 갱신 문제 | 저 | 토큰 자동 갱신 로직 |
| 대용량 패키지 처리 | 중 | 크기 제한 + CDN |

### 시장 리스크
| 리스크 | 확률 | 완화 전략 |
|--------|------|-----------|
| 생태계 성장 실패 | 중 | 공식 에이전트 10개 우선 |
| 경쟁사 추격 | 중 | 차별화 기능 우선 개발 |
| AI 기술 급변 | 높음 | Provider 추상화 유지 |

---

## 🚦 의사결정 포인트

### Month 2: Phase 1 검증
- ✅ GO: CLI 기본 동작 확인 + 베타 10명 확보
- ❌ STOP: 인증 연동 실패 or 사용자 피드백 부정적

### Month 4: Phase 2 진입
- ✅ GO: 베타 50명 + 다운로드 500회 + NPS > 30
- ❌ STOP: 사용자 < 20명 or 활성도 < 10%

### Month 8: Phase 3 진입
- ✅ GO: 커뮤니티 에이전트 20개 + 기업 관심 2곳
- ❌ STOP: 성장 정체 or 경쟁 열세

---

## 📝 다음 단계

### 즉시 (이번 주)
1. [ ] Nexus + Supabase PoC
   - Nexus Repository 설치 (Docker)
   - Supabase 프로젝트 생성
   - 인증 프록시 프로토타입

2. [ ] agent.yaml 스펙 초안
   - 필수 필드 정의
   - 예시 에이전트 작성

### 1주 후
3. [ ] 개발 스프린트 계획
   - Sprint 1 (Week 1-2): 인증 프록시
   - Sprint 2 (Week 3-4): CLI 기본 명령어

4. [ ] 베타 사용자 모집
   - 랜딩 페이지
   - 대기자 명단

### 2주 후
5. [ ] 첫 공식 에이전트 개발
   - @crewx/dev 프로토타입
   - 문서 및 튜토리얼

---

*최종 업데이트: 2025-10-10*
*작성자: Dev Lead*
