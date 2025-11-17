# WBS-31: Marketplace 구현 (Phase 1 - MVP)

> **목표**: 투자자 데모용 Marketplace MVP 구축 (3일, 30분 단위 작업)

**⚠️ MVP 전용 설계**: 프로덕션은 별도 재구축 예정 (Phase 2+)

**상태**: ⬜️ 대기
**우선순위**: P1
**예상 소요**: 3일 (24시간)
**전제 조건**: WBS-30 전략 승인 완료

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [Day 1: 프로젝트 세팅](#day-1-프로젝트-세팅)
5. [Day 2: 데이터 및 UI](#day-2-데이터-및-ui)
6. [Day 3: 완성 및 배포](#day-3-완성-및-배포)
7. [검증 기준](#검증-기준)

---

## 프로젝트 개요

### WBS-30과의 차이
- **WBS-30**: 전략 문서 (비즈니스 모델, IP 보호, 3-Tier 전략)
- **WBS-31**: 실제 구현 계획 (Phase 1 MVP만, 30분 단위 작업)

### Phase 1 MVP 범위
```
포함:
✅ Agent 목록 페이지 (10개 샘플)
✅ Agent 상세 페이지
✅ 검색/필터 기능
✅ CLI 설치 명령어 복사
✅ 정적 배포 (Vercel 무료)

제외 (Phase 2+):
❌ 암호화/라이선스 시스템
❌ 결제 시스템
❌ 리뷰/레이팅
❌ 개발자 대시보드
❌ NestJS 백엔드
```

### 산출물
1. **crewx-marketplace** Git 프로젝트
2. **작동하는 웹사이트** (marketplace.crewx.dev)
3. **투자자 데모 스크립트**
4. **10개 샘플 Agent 데이터**

---

## 기술 스택

### 풀스택 (Astro 하이브리드) ⭐ MVP 전용

```
Framework:   Astro 4.x (하이브리드 모드)
  - 정적:    Agent 목록, 홈페이지 (SSG)
  - 동적:    Agent 상세 (SSR, 필요시)
  - API:     Serverless Functions (관리자 도구)

ORM:         Prisma 5.x
Database:    PostgreSQL (Supabase 무료 tier)
Styling:     Tailwind CSS 3.x
Deployment:  Vercel (무료)
```

**Astro 하이브리드 선택 이유**:
- ✅ **단일 프로젝트** (NestJS 불필요, 복잡도 최소화)
- ✅ **MVP 빠른 구축** (3일 내 완성 가능)
- ✅ **완전 무료** (Vercel Free Tier 충분)
- ✅ **점진적 확장** (정적 → SSR → Serverless)

**⚠️ 프로덕션 고려사항**:
- ❌ Serverless 비용 (트래픽 증가 시)
- ❌ NestJS 생태계 없음 (DI, Guards 등)
- 📝 Phase 2에서 NestJS + Astro 분리 아키텍처로 재구축 예정

---

## 프로젝트 구조

```
crewx-marketplace/
├── package.json
├── astro.config.mjs               # output: 'hybrid'
├── tailwind.config.mjs
├── tsconfig.json
│
├── prisma/
│   ├── schema.prisma              # DB 스키마
│   └── seed.ts                    # 샘플 데이터
│
├── src/
│   ├── pages/
│   │   ├── index.astro            # 홈페이지 (정적)
│   │   ├── agents/[id].astro      # Agent 상세
│   │   ├── browse.astro           # 카테고리별 탐색
│   │   │
│   │   └── api/                   # Serverless Functions
│   │       ├── agents.ts          # GET /api/agents
│   │       └── categories.ts      # GET /api/categories
│   │
│   ├── components/
│   │   ├── AgentCard.astro
│   │   ├── Layout.astro
│   │   └── InstallButton.astro
│   │
│   └── lib/
│       ├── prisma.ts              # Prisma Client
│       └── types.ts               # TypeScript 타입
│
└── public/
    └── favicon.svg
```

---

## 의사결정 요약 (CEO 승인)

### 🎯 핵심 결정 사항

**1. 기술 스택: Astro 하이브리드 단독** ✅
- **결정**: NestJS 제거, Astro 하나로 풀스택 구현
- **이유**: MVP 빠른 구축 (3일), 완전 무료, 단일 프로젝트 관리
- **프로덕션**: Phase 2에서 NestJS + Astro 분리 아키텍처 재검토

**2. Template vs Agent 엔티티** ✅
- **결정**: MVP에서는 Agent 엔티티만 구현 (Template 제외)
- **이유**: WBS-31 범위 축소 (3일 유지)
- **향후**: WBS-32에서 Template 별도 엔티티로 구현

**3. Registry 업데이트 전략** ✅
- **결정**: 수동 빌드 (MVP)
- **방법**: `pnpm db:seed` → Astro 빌드 → Vercel 배포
- **향후**: Phase 2에서 GitHub Actions 자동화

**4. 배포 플랫폼** ✅
- **결정**: Vercel (완전 무료)
- **구성**: Vercel (Astro + Serverless) + Supabase (PostgreSQL)
- **비용**: $0 (Free Tier 충분)

---

## Day 1: 프로젝트 세팅

**목표**: Astro + Prisma + Supabase 연결 완료

### Task 1-1: Astro 프로젝트 생성 (1h)

```bash
# GitHub 레포 생성
cd ~/git
git clone https://github.com/crewx-framework/crewx-marketplace.git
cd crewx-marketplace

# Astro 초기화
pnpm create astro@latest . --template minimal --typescript strict

# Tailwind 추가
pnpm astro add tailwind
pnpm astro add vercel

# 기본 의존성
pnpm add -D @astrojs/check
```

**astro.config.mjs**:
```typescript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://marketplace.crewx.dev',
  output: 'hybrid',  // 🔥 정적 + SSR 혼합
  adapter: vercel(),
  integrations: [tailwind()],
});
```

**검증**:
```bash
pnpm dev
# http://localhost:4321 접속 확인
```

---

### Task 1-2: Prisma + Supabase 설정 (1h)

**Supabase 프로젝트 생성**:
1. https://supabase.com → New Project
2. Project name: `crewx-marketplace`
3. Database Password 복사
4. Connection String 복사

**Prisma 초기화**:
```bash
pnpm add prisma @prisma/client
pnpm add -D tsx

npx prisma init
```

**.env**:
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

**prisma/schema.prisma**:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Agent {
  id          String   @id @default(cuid())
  name        String
  tagline     String
  description String   @db.Text

  author      String
  version     String   @default("1.0.0")
  price       String?

  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  tags        String[]

  featured    Boolean  @default(false)
  gitUrl      String
  installCmd  String

  installs    Int      @default(0)
  rating      Float    @default(0.0)

  features    String[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([categoryId])
  @@index([featured])
}

model Category {
  id     String  @id @default(cuid())
  slug   String  @unique
  name   String
  icon   String
  agents Agent[]
}
```

**Prisma Push**:
```bash
npx prisma db push
npx prisma generate
```

**검증**:
```bash
npx prisma studio
# http://localhost:5555 확인
```

---

### Task 1-3: Seed 데이터 작성 (1h)

**prisma/seed.ts**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 카테고리
  const marketing = await prisma.category.upsert({
    where: { slug: 'marketing' },
    update: {},
    create: { slug: 'marketing', name: 'Marketing', icon: '📊' },
  });

  const development = await prisma.category.upsert({
    where: { slug: 'development' },
    update: {},
    create: { slug: 'development', name: 'Development', icon: '💻' },
  });

  // Agent 샘플 10개
  const agents = [
    {
      id: 'premium-seo',
      name: 'Premium SEO Expert',
      tagline: 'Advanced SEO analysis and optimization',
      description: 'Professional SEO consultant agent',
      author: 'crewx-team',
      categoryId: marketing.id,
      tags: ['seo', 'marketing'],
      featured: true,
      gitUrl: 'https://github.com/crewx-agents/premium-seo',
      installCmd: 'crewx install premium-seo',
      features: ['🔍 Technical SEO', '📊 Analytics', '✍️ Content optimization'],
      installs: 1247,
      rating: 4.8,
    },
    {
      id: 'social-media-manager',
      name: 'Social Media Manager',
      tagline: 'Automate your social media',
      description: 'AI-powered social media automation',
      author: 'crewx-team',
      categoryId: marketing.id,
      tags: ['social-media', 'automation'],
      featured: true,
      price: 'Free',
      gitUrl: 'https://github.com/crewx-agents/social-media',
      installCmd: 'crewx install social-media-manager',
      features: ['📱 Multi-platform', '🤖 Auto-scheduling'],
      installs: 2341,
      rating: 4.6,
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer Pro',
      tagline: 'Automated code review',
      description: 'Expert code reviewer',
      author: 'crewx-team',
      categoryId: development.id,
      tags: ['code-review', 'quality'],
      featured: false,
      price: 'Free',
      gitUrl: 'https://github.com/crewx-agents/code-reviewer',
      installCmd: 'crewx install code-reviewer',
      features: ['🔍 Deep analysis', '📝 Suggestions'],
      installs: 3421,
      rating: 4.9,
    },
    // ... 7개 더 추가
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: {},
      create: agent,
    });
  }

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**package.json 스크립트**:
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

**실행**:
```bash
pnpm db:seed
```

---

### Task 1-4: Prisma Client 설정 (0.5h)

**src/lib/prisma.ts**:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**src/lib/types.ts**:
```typescript
export interface Agent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  author: string;
  price?: string;
  category: { slug: string; name: string; icon: string };
  tags: string[];
  featured: boolean;
  installCmd: string;
  installs: number;
  rating: number;
  features: string[];
}
```

---

## Day 2: 데이터 및 UI

**목표**: Agent 목록/상세 페이지 완성

### Task 2-1: API Routes 구현 (1h)

**src/pages/api/agents.ts**:
```typescript
import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';

export const GET: APIRoute = async () => {
  const agents = await prisma.agent.findMany({
    include: { category: true },
    orderBy: { featured: 'desc' },
  });

  return new Response(JSON.stringify(agents), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false; // Serverless
```

**src/pages/api/categories.ts**:
```typescript
import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';

export const GET: APIRoute = async () => {
  const categories = await prisma.category.findMany({
    include: { agents: true },
  });

  return new Response(JSON.stringify(categories), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
```

---

### Task 2-2: 홈페이지 구현 (1.5h)

**src/layouts/Layout.astro**:
```astro
---
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body class="bg-gray-50">
    <header class="bg-white shadow">
      <nav class="container mx-auto px-4 py-4 flex justify-between">
        <a href="/" class="text-2xl font-bold text-blue-600">CrewX Marketplace</a>
        <div class="flex gap-6">
          <a href="/browse">Browse</a>
          <a href="https://github.com/crewx-framework/crewx">GitHub</a>
        </div>
      </nav>
    </header>

    <main class="min-h-screen">
      <slot />
    </main>

    <footer class="bg-gray-900 text-white py-12">
      <div class="container mx-auto px-4 text-center">
        <p>© 2025 CrewX Framework</p>
      </div>
    </footer>
  </body>
</html>
```

**src/components/AgentCard.astro**:
```astro
---
import type { Agent } from '../lib/types';

interface Props {
  agent: Agent;
}

const { agent } = Astro.props;
---

<a href={`/agents/${agent.id}`} class="block bg-white rounded-lg shadow-md hover:shadow-xl transition p-6">
  <div class="flex justify-between mb-4">
    <div>
      <h3 class="text-xl font-bold">{agent.name}</h3>
      <p class="text-gray-600 text-sm">{agent.tagline}</p>
    </div>
    {agent.price && (
      <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
        {agent.price}
      </span>
    )}
  </div>

  <p class="text-gray-700 mb-4 line-clamp-2">{agent.description}</p>

  <div class="flex gap-2 mb-4">
    {agent.tags.slice(0, 3).map(tag => (
      <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{tag}</span>
    ))}
  </div>

  <div class="flex justify-between text-sm text-gray-600">
    <span>⭐ {agent.rating}</span>
    <span>📥 {agent.installs}</span>
  </div>
</a>
```

**src/pages/index.astro**:
```astro
---
import Layout from '../layouts/Layout.astro';
import AgentCard from '../components/AgentCard.astro';
import { prisma } from '../lib/prisma';

const featuredAgents = await prisma.agent.findMany({
  where: { featured: true },
  include: { category: true },
  take: 6,
});

export const prerender = true; // 정적 생성
---

<Layout title="CrewX Marketplace">
  <!-- Hero -->
  <section class="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
    <div class="container mx-auto px-4 text-center">
      <h1 class="text-5xl font-bold mb-4">CrewX AI Agent Marketplace</h1>
      <p class="text-xl mb-8">Discover, install, and monetize AI agents</p>
      <a href="/browse" class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold">
        Browse Agents
      </a>
    </div>
  </section>

  <!-- Featured Agents -->
  <section class="container mx-auto px-4 py-16">
    <h2 class="text-3xl font-bold mb-8">Featured Agents</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {featuredAgents.map(agent => <AgentCard agent={agent} />)}
    </div>
  </section>
</Layout>
```

---

### Task 2-3: Agent 상세 페이지 (1.5h)

**src/pages/agents/[id].astro**:
```astro
---
import Layout from '../../layouts/Layout.astro';
import { prisma } from '../../lib/prisma';

export async function getStaticPaths() {
  const agents = await prisma.agent.findMany();
  return agents.map((agent) => ({
    params: { id: agent.id },
  }));
}

const { id } = Astro.params;
const agent = await prisma.agent.findUnique({
  where: { id },
  include: { category: true },
});

if (!agent) return Astro.redirect('/404');
---

<Layout title={`${agent.name} - CrewX Marketplace`}>
  <div class="container mx-auto px-4 py-16">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-2">
        <h1 class="text-4xl font-bold mb-2">{agent.name}</h1>
        <p class="text-xl text-gray-600 mb-6">{agent.tagline}</p>

        <div class="prose max-w-none mb-8">
          <h2>About</h2>
          <p>{agent.description}</p>
        </div>

        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4">Features</h2>
          <ul class="space-y-2">
            {agent.features.map(feature => (
              <li class="flex gap-2">
                <span class="text-green-600">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow-lg p-6 sticky top-4">
          {agent.price && (
            <div class="text-3xl font-bold mb-4">{agent.price}</div>
          )}

          <button
            class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            onclick="navigator.clipboard.writeText(this.dataset.cmd); this.textContent='✅ Copied!'; setTimeout(() => this.textContent='📥 Install', 2000)"
            data-cmd={agent.installCmd}
          >
            📥 Install
          </button>

          <div class="mt-6 pt-6 border-t space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Rating</span>
              <span class="font-semibold">⭐ {agent.rating}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Installs</span>
              <span class="font-semibold">{agent.installs}</span>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t">
            <p class="text-sm text-gray-600">Created by</p>
            <p class="font-semibold">{agent.author}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</Layout>
```

---

## Day 3: 완성 및 배포

**목표**: 검색 기능 + Vercel 배포 + 데모 준비

### Task 3-1: 검색 페이지 (1h)

**src/pages/browse.astro**:
```astro
---
import Layout from '../layouts/Layout.astro';
import AgentCard from '../components/AgentCard.astro';
import { prisma } from '../lib/prisma';

const category = Astro.url.searchParams.get('category');
const query = Astro.url.searchParams.get('q');

let agents = await prisma.agent.findMany({
  where: {
    ...(category && { category: { slug: category } }),
    ...(query && {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    }),
  },
  include: { category: true },
});

const categories = await prisma.category.findMany();

export const prerender = false; // SSR
---

<Layout title="Browse Agents - CrewX Marketplace">
  <div class="container mx-auto px-4 py-16">
    <!-- Search Bar -->
    <form method="get" class="mb-8">
      <div class="flex gap-2">
        <input
          type="text"
          name="q"
          value={query || ''}
          placeholder="Search agents..."
          class="flex-1 px-4 py-3 border rounded-lg"
        />
        <button type="submit" class="bg-blue-600 text-white px-6 py-3 rounded-lg">
          Search
        </button>
      </div>
    </form>

    <!-- Categories -->
    <div class="flex gap-4 mb-8">
      <a href="/browse" class="px-4 py-2 rounded-lg bg-gray-100">All</a>
      {categories.map(cat => (
        <a
          href={`/browse?category=${cat.slug}`}
          class="px-4 py-2 rounded-lg bg-gray-100"
        >
          {cat.icon} {cat.name}
        </a>
      ))}
    </div>

    <!-- Results -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map(agent => <AgentCard agent={agent} />)}
    </div>

    {agents.length === 0 && (
      <p class="text-center text-gray-600">No agents found.</p>
    )}
  </div>
</Layout>
```

---

### Task 3-2: Vercel 배포 (1h)

**vercel.json**:
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install"
}
```

**배포**:
```bash
# Vercel CLI 설치
pnpm add -g vercel

# 배포
vercel deploy --prod

# 환경 변수 설정
vercel env add DATABASE_URL
# Supabase connection string 입력
```

**커스텀 도메인 설정** (선택):
```bash
vercel domains add marketplace.crewx.dev
```

---

### Task 3-3: 투자자 데모 준비 (1h)

**DEMO.md**:
```markdown
# CrewX Marketplace 투자자 데모

## 1. 웹사이트 시연 (2분)

### 홈페이지
- URL: https://marketplace.crewx.dev
- Featured Agents 표시 (6개)
- "10개 에이전트, 2개 카테고리"

### Agent 상세
- Premium SEO Expert 클릭
- 기능, 통계, 가격 표시
- Install 버튼 → CLI 명령어 복사

### 검색
- "seo" 검색 → 필터링 결과
- 카테고리별 필터 (Marketing, Development)

## 2. 비즈니스 모델 (2분)

- 3-Tier 모델 (무료/유료/엔터프라이즈)
- 개발자 수익 분배 (70%/30%)
- IP 보호 (Phase 2)
- 확장 가능성

## 3. 기술적 차별점 (1분)

- 로컬 AI 지원 (프라이버시)
- 오픈소스 철학
- 빠른 MVP 구축 (3일)
```

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

## 다음 단계 (Phase 2+)

**WBS-32: 암호화 시스템** (2-3주)
- YAML 암호화/복호화
- 라이선스 서버 (NestJS)
- Hardware fingerprinting
- 로깅 시스템 (3-level)

**WBS-33: NestJS 백엔드 구축** (2주)
- Astro + NestJS 분리 아키텍처
- 관리자 대시보드
- Stripe 결제 연동
- `crewx publish` 명령어

**WBS-34: 프로덕션 확장** (2-3개월)
- Analytics 대시보드
- 리뷰/레이팅 시스템
- 커뮤니티 기능
- 엔터프라이즈 플랜

---

## 참고 자료

- [WBS-30: Marketplace MVP 전략](wbs-30-marketplace-mvp.md)
- [Astro 공식 문서](https://docs.astro.build)
- [Prisma 가이드](https://www.prisma.io/docs)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database)
