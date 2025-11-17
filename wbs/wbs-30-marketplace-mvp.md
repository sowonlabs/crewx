# WBS-30: Marketplace MVP 상세 설계

> **목표**: 투자자 데모용 극초기 앱스토어 구축 (오픈소스 + 수익화 전략 검증)

**상태**: ⬜️ 대기
**우선순위**: P1
**예상 소요**: 2-3일 (Phase 1 MVP)

---

## 📋 목차

1. [배경 및 전략](#배경-및-전략)
2. [아키텍처](#아키텍처)
3. [사용자 경험](#사용자-경험)
4. [기술 스펙](#기술-스펙)
5. [구현 계획](#구현-계획)
6. [비용 및 리스크](#비용-및-리스크)

---

## 배경 및 전략

### 핵심 과제
- 오픈소스와 수익화 양립 필요
- 서드파티 개발자 IP 보호
- 투자자에게 편의성 어필 (에이전트 마켓플레이스)

### 3-Tier 모델

| Tier | 가격 | YAML 보호 | 수익 분배 |
|------|------|-----------|----------|
| **무료** | Free | 완전 공개 | 개발자 100% (CrewX는 마케팅 제공) |
| **유료** | $19-49/월 | 암호화 + 라이선스 | 개발자 70% / CrewX 30% |
| **엔터프라이즈** | $499+/월 | 커스텀 계약 | 개발자 60% / CrewX 40% |

### IP 보호 전략

**기술적 보호**:
- AES-256-GCM 암호화
- 라이선스 서버 검증 (하드웨어 핑거프린트)
- 메모리에서만 복호화 (디스크 저장 금지)
- 30일 오프라인 grace period

**로깅 시스템** (3-Level):
```typescript
// Level 1: Public Logs (항상 표시)
[INFO] Prompt rendered (2,450 tokens)
- Template: <protected>
- Variables: ["site_url", "target_keywords"]

// Level 2: Developer Mode (--dev-mode 플래그)
[DEBUG] Decrypted prompt template:
---
You are an SEO expert...
---

// Level 3: Protected Logs (일반 사용자)
[INFO] Sending request to AI provider
- Model: claude-sonnet-4
- System Prompt: <protected>
```

**법적 보호**:
- 워터마킹 (라이선스별 고유 문자열 삽입)
- 유출 추적 가능
- 약관 위반 시 법적 조치

---

## 아키텍처

### 시스템 구조

```
Marketplace (marketplace.crewx.dev)
├── 프론트엔드 (Astro 정적 사이트)
│   ├── 검색/브라우징 UI
│   ├── 에이전트 상세 페이지
│   └── "Install" 버튼 (CLI 명령어 복사)
│
├── Registry (정적 JSON)
│   └── registry.json (메타데이터)
│       ├── 에이전트 목록
│       ├── 카테고리
│       ├── Featured 에이전트
│       └── 통계 정보
│
└── Storage (Git)
    └── GitHub repos (실제 에이전트 코드)
        ├── crewx-agents/premium-seo
        ├── crewx-agents/legal-advisor
        └── ...
```

### Registry 스펙

```json
{
  "version": "1.0.0",
  "agents": [
    {
      "id": "premium-seo",
      "name": "Premium SEO Expert",
      "tagline": "Advanced SEO analysis and optimization",
      "description": "Professional SEO consultant agent",
      "longDescription": "This agent combines cutting-edge SEO strategies...",
      "author": "john-doe",
      "authorUrl": "https://github.com/john-doe",
      "version": "1.0.0",
      "price": "$29/month",
      "pricingModel": "subscription",
      "category": "marketing",
      "tags": ["seo", "marketing", "analytics"],
      "featured": true,

      "git_url": "https://github.com/crewx-agents/premium-seo",
      "encrypted": true,
      "license_required": true,

      "installCommand": "crewx install premium-seo --license YOUR_KEY",

      "stats": {
        "installs": 1247,
        "rating": 4.8,
        "reviews": 89
      },

      "features": [
        "🔍 Technical SEO audits",
        "📊 Competitor analysis",
        "✍️ Content optimization",
        "📈 Rank tracking"
      ],

      "examples": [
        {
          "command": "crewx query \"@premium_seo analyze https://example.com\"",
          "description": "Perform comprehensive SEO audit"
        },
        {
          "command": "crewx query \"@premium_seo competitors for 'AI tools'\"",
          "description": "Analyze top competitors for a keyword"
        }
      ],

      "requirements": {
        "crewx_version": ">=0.1.0",
        "license": "required"
      }
    }
  ],

  "categories": [
    { "id": "marketing", "name": "Marketing", "icon": "📊" },
    { "id": "development", "name": "Development", "icon": "💻" },
    { "id": "legal", "name": "Legal", "icon": "⚖️" },
    { "id": "finance", "name": "Finance", "icon": "💰" }
  ]
}
```

---

## 사용자 경험

### UX Flow 1: 웹사이트에서 발견 → CLI 설치

```
1. 사용자가 marketplace.crewx.dev 방문
2. "SEO Expert" 에이전트 발견
3. 상세 페이지 클릭
4. "Install" 버튼 클릭 → CLI 명령어 복사됨:

   crewx install premium-seo --license YOUR_KEY

5. 터미널에 붙여넣기 → 즉시 설치 완료
```

### UX Flow 2: CLI에서 직접 검색/설치

```bash
# 검색
crewx search "seo"
# Output:
# premium-seo - Premium SEO Expert ($29/month)
# Advanced SEO analysis and optimization
# ⭐⭐⭐⭐⭐ (127 installs)

# 상세 정보
crewx info premium-seo
# Output:
# Premium SEO Expert v1.0.0
# Author: john-doe
# Price: $29/month
# ...
# Installation:
# crewx install premium-seo --license YOUR_KEY

# 설치
crewx install premium-seo --license abc-123-xyz
# Output:
# [1/4] Validating license... ✓
# [2/4] Downloading from git... ✓
# [3/4] Decrypting configuration... ✓
# [4/4] Installing to ~/.crewx/agents/premium-seo... ✓
# ✅ Installed premium-seo v1.0.0

# 실행
crewx query "@premium_seo analyze my website"
```

---

## 기술 스펙

### CLI 명령어 (구현 필요)

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `crewx search <keyword>` | 에이전트 검색 | `crewx search "marketing"` |
| `crewx browse [--category <cat>]` | 카테고리별 탐색 | `crewx browse --category marketing` |
| `crewx info <agent-id>` | 상세 정보 표시 | `crewx info premium-seo` |
| `crewx install <agent-id> [--license KEY]` | 설치 | `crewx install premium-seo --license abc-123` |
| `crewx list` | 설치된 에이전트 목록 | `crewx list` |

### 프론트엔드 기술 스택

**Framework**: Astro (정적 사이트 생성)
- **장점**: SEO 최적화, 빠른 로딩, Markdown 지원
- **배포**: Netlify/Vercel (무료)

**스타일링**: Tailwind CSS
- **장점**: 빠른 프로토타이핑, 반응형 디자인

**컴포넌트 구조**:
```
src/
├── pages/
│   ├── index.astro           # 홈페이지
│   ├── agents/[id].astro     # 에이전트 상세
│   ├── browse.astro          # 카테고리별 탐색
│   └── search.astro          # 검색 결과
├── components/
│   ├── AgentCard.astro       # 에이전트 카드
│   ├── CategoryList.astro    # 카테고리 목록
│   ├── SearchBar.astro       # 검색바
│   └── InstallButton.astro   # 설치 버튼 (명령어 복사)
└── lib/
    ├── registry.ts           # Registry 로딩
    └── search.ts             # 검색 로직
```

### 백엔드 (Phase 2+)

**라이선스 서버**: Express + SQLite
```typescript
// 라이선스 검증 API
POST /api/license/validate
{
  "license_key": "abc-123-xyz",
  "hardware_id": "machine-fingerprint",
  "agent_id": "premium-seo"
}

// 응답
{
  "valid": true,
  "decryption_key": "...",
  "expires_at": "2025-02-14T00:00:00Z"
}
```

**암호화 시스템**: Node.js crypto (AES-256)
```typescript
// 암호화
function encryptYAML(yaml: string, licenseKey: string): string {
  const cipher = crypto.createCipher('aes-256-gcm', licenseKey);
  return cipher.update(yaml, 'utf8', 'hex') + cipher.final('hex');
}

// 복호화 (메모리에서만)
function decryptYAML(encrypted: string, licenseKey: string): string {
  const decipher = crypto.createDecipher('aes-256-gcm', licenseKey);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

**Hardware Fingerprinting**: `node-machine-id`
```typescript
import { machineIdSync } from 'node-machine-id';

const hardwareId = machineIdSync();
// 라이선스 키와 결합하여 불법 복제 방지
```

---

## 구현 계획

### Phase 1: MVP (2-3일) - 투자자 데모용

**목표**: 기본 기능 작동 + 데모 가능

**작업 항목**:
- [ ] **Day 1: Registry + CLI**
  - [ ] registry.json 스키마 정의
  - [ ] CLI 명령어 구조 (`search`, `info`, `install`)
  - [ ] Git clone 기반 설치 로직
  - [ ] 2-3개 샘플 에이전트 등록

- [ ] **Day 2: 프론트엔드 뼈대**
  - [ ] Astro 프로젝트 초기화
  - [ ] 홈페이지 (Hero + Featured)
  - [ ] AgentCard 컴포넌트 (Install 명령어 복사 버튼)
  - [ ] 상세 페이지 (에이전트 정보 + 예제)

- [ ] **Day 3: 검색 + 통합**
  - [ ] 검색 로직 (CLI + 웹)
  - [ ] 카테고리 필터링
  - [ ] 통합 테스트 (CLI ↔ 웹사이트)
  - [ ] Netlify 배포

**산출물**:
- ✅ 작동하는 마켓플레이스 웹사이트
- ✅ CLI 검색/설치 명령어
- ✅ 투자자 데모 스크립트

**투자자 데모 스크립트**:
```bash
# "에이전트 마켓플레이스를 보여드리겠습니다"
crewx search "marketing"
# → 10개 에이전트 목록 표시

# "SEO 전문가 에이전트를 살펴보죠"
crewx info premium-seo
# → 상세 정보, 가격, 리뷰 표시

# "라이선스로 설치합니다"
crewx install premium-seo --license demo-key-123
# → [1/4] [2/4] [3/4] [4/4] 프로그레스 표시

# "바로 사용 가능합니다"
crewx query "@premium_seo analyze https://example.com"
# → 즉시 분석 시작

# 🎉 "개발자가 만든 에이전트를 이렇게 쉽게 배포하고 수익화할 수 있습니다"
```

---

### Phase 2: 암호화 시스템 (2-3주) - 실제 파일럿

**목표**: 유료 에이전트 보호 + 라이선스 검증

**작업 항목**:
- [ ] **Week 1: 암호화 인프라**
  - [ ] YAML 암호화/복호화 로직
  - [ ] 라이선스 서버 (Express + SQLite)
  - [ ] Hardware fingerprinting
  - [ ] 30일 grace period 캐시

- [ ] **Week 2: 로깅 시스템**
  - [ ] ProtectedLogger 서비스
  - [ ] 3-level logging (Public/Developer/Protected)
  - [ ] `--dev-mode` 플래그 구현
  - [ ] 워터마킹 시스템

- [ ] **Week 3: 테스트 + 파일럿**
  - [ ] 단위 테스트 (암호화, 라이선스)
  - [ ] 통합 테스트 (CLI ↔ 서버)
  - [ ] 파트너 개발자 2-3명 섭외
  - [ ] 베타 테스트

**산출물**:
- ✅ 암호화된 YAML 시스템
- ✅ 라이선스 검증 서버
- ✅ 보호된 로깅 시스템

---

### Phase 3: 마켓플레이스 확장 (3-4개월) - 프로덕션

**목표**: 완전한 생태계 구축

**작업 항목**:
- [ ] **Month 1: 결제 + 개발자 도구**
  - [ ] Stripe 결제 연동
  - [ ] 개발자 대시보드
  - [ ] `crewx publish` 명령어 (에이전트 배포)
  - [ ] 자동 버전 관리

- [ ] **Month 2: 커뮤니티 기능**
  - [ ] 리뷰/레이팅 시스템
  - [ ] 댓글 및 피드백
  - [ ] 에이전트 랭킹
  - [ ] 개발자 프로필

- [ ] **Month 3: 고급 기능**
  - [ ] Analytics 대시보드 (개발자용)
  - [ ] Split-Prompt Delivery (ultra-premium)
  - [ ] 엔터프라이즈 플랜
  - [ ] 커스텀 계약 관리

**산출물**:
- ✅ 프로덕션 마켓플레이스
- ✅ 10-20개 프리미엄 에이전트
- ✅ 수익화 검증

---

## 비용 및 리스크

### 비용 구조

| Phase | 인프라 비용 | 설명 |
|-------|------------|------|
| **Phase 1 (MVP)** | $0 | Netlify + GitHub 무료 |
| **Phase 2 (파일럿)** | ~$50-100/월 | 라이선스 서버 (AWS EC2 t3.micro) |
| **Phase 3 (프로덕션)** | ~$200-500/월 | 서버 + DB + CDN + 결제 처리 |

### 기술적 실현 가능성

**결론**: ✅ 100% 가능

**난이도**: 중 (2-3주, 1명 개발자)

**핵심 기술**:
- Node.js crypto (AES-256) ✅ 이미 있음
- Express.js ✅ 익숙함
- TypeScript ✅ CrewX 기본 스택
- SQLite ✅ 간단함

**비교**:
- Cursor의 프롬프트 보호보다 **쉬움** (걔네는 Electron + 난독화)
- JetBrains 라이선스 시스템보다 **훨씬 쉬움** (걔네는 Java 바이트코드 난독화)
- VSCode 마켓플레이스보다 **비슷** (걔네도 암호화 + 라이선스)

### 리스크 분석

**리스크 1: 메모리 덤프 공격**
- **현실**: 완벽한 방어 불가능 (게임 해킹도 막지 못함)
- **대응**: 워터마킹 + 법적 보호 + "충분한 장벽" 전략
- **수용 수준**: 70% 보호 (초기) → 50% 보호 (중기) → 30% 보호 (성숙기)

**리스크 2: DRM 거부감**
- **현실**: 개발자들이 "DRM 싫어요" 하며 이탈
- **대응**: 3-tier 전략
  - 무료 tier: 완전 공개 YAML (진입장벽 제로)
  - 유료 tier: 암호화 선택 (개발자 선택권)
  - 엔터프라이즈: 커스텀 계약
- **사례**: VSCode, JetBrains - 가치가 명확하면 DRM 수용

**리스크 3: 프롬프트 품질 차별화 부족**
- **현실**: "프롬프트만으로는 차별화 안됨"
- **대응**: 프롬프트 → 통합 경험 → 생태계로 확장
  - 프리미엄 = 프롬프트 + 도구 통합 + 지속 업데이트 + 커뮤니티
- **사례**: Cursor ($5000/년) - 잘 만든 프롬프트에 돈 냄

### 참고 사례

| 사례 | 가격 | 보호 방식 | 시사점 |
|------|------|----------|--------|
| **VSCode Marketplace** | 무료~유료 | 암호화 + 라이선스 | 개발자 생태계 성공 사례 |
| **JetBrains Plugins** | ~$99/년 | 라이선스 검증 | DRM 수용 가능 |
| **Cursor** | $5000/년 | 프롬프트 보호 | 프롬프트에 돈 내는 시장 검증 |
| **GitHub Copilot** | $10-19/월 | SaaS 모델 | AI 도구 구독 시장 검증 |

---

## 다음 단계

**즉시 실행할 것**:
1. ✅ 경영진 승인
2. ⬜️ Phase 1 착수 (2-3일)
3. ⬜️ 투자자 데모 준비

**핵심 메시지**:
> "CrewX는 로컬 AI를 사용하면서도 서드파티 IP를 보호합니다.
> 암호화 + 라이선스 검증으로 적절한 보호를 제공하되,
> 무료 tier는 완전 공개로 오픈소스 정신을 유지합니다."

**전략 특징**:
- ✅ 오픈소스 철학 유지 (무료 tier 완전 공개)
- ✅ 서드파티 개발자 보호 (암호화 + 라이선스)
- ✅ CrewX 비용 최소화 (라이선스 서버만 운영)
- ✅ 사용자 경험 유지 (로컬 AI 사용)
