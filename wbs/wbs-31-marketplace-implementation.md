# WBS-31: Marketplace 구현 (MVP)

> **목표**: 투자자 데모용 Marketplace MVP 구축
> **상태**: ⬜️ 대기
> **우선순위**: P1
> **예상 소요**: 3일 (24시간)
> **전제 조건**: WBS-30 전략 승인 완료

**⚠️ MVP 전용 설계**: 프로덕션은 별도 재구축 예정 (Phase 2+)

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [의사결정 요약](#의사결정-요약)
4. [Phase 구성](#phase-구성)
5. [검증 기준](#검증-기준)

---

## 프로젝트 개요

### WBS-30과의 차이
- **WBS-30**: 전략 문서 (비즈니스 모델, IP 보호, 3-Tier 전략)
- **WBS-31**: 실제 구현 계획 (Phase 1 MVP만)

### Phase 1 MVP 범위

**포함**:
- ✅ Agent 목록 페이지 (10개 샘플)
- ✅ Agent 상세 페이지
- ✅ 검색/필터 기능
- ✅ CLI 설치 명령어 복사
- ✅ 정적 배포 (Vercel 무료)

**제외 (Phase 2+)**:
- ❌ 암호화/라이선스 시스템
- ❌ 결제 시스템
- ❌ 리뷰/레이팅
- ❌ 개발자 대시보드
- ❌ NestJS 백엔드

### 산출물
1. crewx-marketplace Git 프로젝트
2. 작동하는 웹사이트 (marketplace.crewx.dev)
3. 투자자 데모 스크립트
4. 10개 샘플 Agent 데이터

---

## 기술 스택

### Astro 하이브리드 (MVP 전용)

```
Framework:   Astro 4.x (하이브리드 모드)
  - 정적:    Agent 목록, 홈페이지 (SSG)
  - 동적:    Agent 상세 (SSR)
  - API:     Serverless Functions

ORM:         Prisma 5.x
Database:    PostgreSQL (Supabase 무료)
Styling:     Tailwind CSS 3.x
Deployment:  Vercel (무료)
```

**선택 이유**:
- ✅ 단일 프로젝트 (NestJS 불필요)
- ✅ MVP 빠른 구축 (3일 완성)
- ✅ 완전 무료 (Vercel Free Tier)
- ✅ 점진적 확장 가능

**⚠️ 프로덕션 고려**:
- Phase 2에서 NestJS + Astro 분리 아키텍처로 재구축 예정

---

## 의사결정 요약

### 핵심 결정 사항

**1. 기술 스택: Astro 하이브리드 단독** ✅
- NestJS 제거, Astro로 풀스택 구현
- MVP 빠른 구축 목적

**2. Template vs Agent 엔티티** ✅
- MVP에서는 Agent 엔티티만 구현
- WBS-32에서 Template 별도 구현

**3. Registry 업데이트 전략** ✅
- MVP: 수동 빌드 (`pnpm db:seed` → Astro 빌드 → Vercel 배포)
- Phase 2: GitHub Actions 자동화

**4. 배포 플랫폼** ✅
- Vercel + Supabase (완전 무료)

---

## Phase 구성

### 일정: 3일

| Phase | 작업 | 소요 | 산출물 | 상세 문서 |
|-------|------|------|--------|-----------|
| Phase 1 | 프로젝트 세팅 | 8시간 | Astro + Prisma + Supabase 연결 | [Phase 1 상세](wbs-31-phase-1-setup.md) |
| Phase 2 | 데이터 및 UI | 8시간 | Agent 목록/상세 페이지 | [Phase 2 상세](wbs-31-phase-2-ui.md) |
| Phase 3 | 완성 및 배포 | 8시간 | 검색 + Vercel 배포 + 데모 | [Phase 3 상세](wbs-31-phase-3-deploy.md) |

### Phase 1: 프로젝트 세팅 (8시간)
- Astro 프로젝트 생성 (1h)
- Prisma + Supabase 설정 (1h)
- Seed 데이터 작성 (1h)
- Prisma Client 설정 (0.5h)

### Phase 2: 데이터 및 UI (8시간)
- API Routes 구현 (1h)
- 홈페이지 구현 (1.5h)
- Agent 상세 페이지 (1.5h)

### Phase 3: 완성 및 배포 (8시간)
- 검색 페이지 (1h)
- Vercel 배포 (1h)
- 투자자 데모 준비 (1h)

---

## 검증 기준

### Phase 1 MVP 완료 조건

**기능적 요구사항**:
- ✅ 10개 Agent 목록 표시
- ✅ Agent 상세 페이지
- ✅ 검색 기능
- ✅ 카테고리 필터
- ✅ CLI 명령어 복사

**기술적 요구사항**:
- ✅ Astro 빌드 성공
- ✅ Vercel 배포 성공
- ✅ Lighthouse 성능 90+ 점
- ✅ 모바일 반응형
- ✅ SEO 최적화

**비즈니스 요구사항**:
- ✅ 투자자 데모 가능
- ✅ 3-Tier 모델 설명 가능
- ✅ Phase 2/3 로드맵 명확

---

## 다음 단계

### Phase 2: 암호화 시스템 (2-3주)
- YAML 암호화/복호화
- 라이선스 서버 (NestJS)
- Hardware fingerprinting
- 로깅 시스템

### Phase 3: NestJS 백엔드 (2주)
- Astro + NestJS 분리 아키텍처
- 관리자 대시보드
- Stripe 결제 연동
- `crewx publish` 명령어

### Phase 4: 프로덕션 확장 (2-3개월)
- Analytics 대시보드
- 리뷰/레이팅 시스템
- 커뮤니티 기능
- 엔터프라이즈 플랜

---

## 참고 문서

- [Phase 1: 프로젝트 세팅](wbs-31-phase-1-setup.md)
- [Phase 2: 데이터 및 UI](wbs-31-phase-2-ui.md)
- [Phase 3: 완성 및 배포](wbs-31-phase-3-deploy.md)
- [WBS-30: Marketplace MVP 전략](wbs-30-marketplace-mvp.md)
- [Astro 공식 문서](https://docs.astro.build)
- [Prisma 가이드](https://www.prisma.io/docs)
- [Vercel 배포 가이드](https://vercel.com/docs)
