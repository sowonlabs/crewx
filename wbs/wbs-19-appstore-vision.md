# CrewX 에이전트 앱스토어 비전

**작성일**: 2025-11-11
**상태**: 🎯 **전략 문서**

---

## 📱 비전: 에이전트 앱스토어

### 핵심 목표
**"누구나 에이전트를 만들고, 공유하고, 사용할 수 있는 플랫폼"**

- 개발자: 에이전트 생성 및 판매
- 비개발자: 원클릭 설치 및 사용
- 기업: 프라이빗 에이전트 레지스트리

---

## 🎯 왜 LangGraph가 아닌 CrewX인가?

### LangGraph의 한계
```python
# ❌ 개발자만 사용 가능
class ResearchAgent:
    def __init__(self):
        workflow = StateGraph(AgentState)
        # 복잡한 코드 작성 필요...
```

**문제점**:
- 코드 작성 능력 필수 → 비개발자 진입 불가
- 배포 메커니즘 없음 → pip install만 가능
- 크로스 플랫폼 지원 없음 → Python only
- 수익화 어려움 → 오픈소스 코드 배포

---

### CrewX의 강점
```yaml
# ✅ 비개발자도 에이전트 생성 가능
agents:
  - id: researcher-pro
    name: "Research Agent Pro"
    version: "1.2.0"
    author: "sowon-ai"

    provider: api/openai
    model: gpt-4

    system_prompt: |
      You are a professional researcher.

    tools: [search, scrape, summarize]
```

**장점**:
- ✅ YAML 설정만으로 에이전트 생성
- ✅ 원클릭 설치: `crewx install researcher-pro`
- ✅ 크로스 플랫폼: CLI + Slack + Web
- ✅ 수익화 가능: 마켓플레이스 + 구독 모델

---

## 🏗️ 앱스토어 아키텍처

### 1. Agent Registry (Central Repository)

```yaml
# registry.crewx.ai/agents/researcher-pro/manifest.yaml
metadata:
  id: researcher-pro
  name: "Research Agent Pro"
  version: "1.2.0"
  author: "sowon-ai"
  description: "Professional research agent with web scraping"

  # 앱스토어 메타데이터
  category: "research"
  tags: ["web", "scraping", "ai", "gpt4"]
  downloads: 15234
  rating: 4.8

pricing:
  model: "freemium"
  tiers:
    - name: "Free"
      price: 0
      limits:
        queries_per_month: 100
    - name: "Pro"
      price: 9.99
      limits:
        queries_per_month: 10000

dependencies:
  tools:
    - search@1.0.0
    - scrape@2.1.0
  mcp:
    - github-mcp@1.5.0

agent:
  provider: api/openai
  model: gpt-4-turbo
  system_prompt: |
    You are a professional researcher...
```

---

### 2. 사용자 워크플로우

#### **에이전트 검색**
```bash
$ crewx search "research"

Results:
  1. researcher-pro (v1.2.0) ⭐4.8
     Professional research agent with web scraping
     Author: sowon-ai | Downloads: 15K | Price: Freemium

  2. academic-researcher (v2.0.1) ⭐4.6
     Academic paper research and citation
     Author: edu-ai | Downloads: 8K | Price: Free
```

#### **에이전트 설치**
```bash
$ crewx install researcher-pro

Installing researcher-pro@1.2.0...
✓ Downloading agent manifest
✓ Resolving dependencies
  - search@1.0.0
  - scrape@2.1.0
  - github-mcp@1.5.0
✓ Installing dependencies
✓ Configuring agent

Installed successfully!

Usage:
  crewx query "@researcher-pro 최신 AI 뉴스 조사해줘"
  /crewx @researcher-pro (in Slack)
```

#### **에이전트 사용**
```bash
# CLI
$ crewx query "@researcher-pro 최신 AI 뉴스 조사해줘"

# Slack
/crewx @researcher-pro 최신 AI 뉴스 조사해줘

# API
curl -X POST https://api.crewx.ai/v1/agents/researcher-pro/query \
  -H "Authorization: Bearer $CREWX_API_KEY" \
  -d '{"input": "최신 AI 뉴스 조사해줘"}'
```

---

### 3. 에이전트 개발자 워크플로우

#### **에이전트 생성**
```bash
$ crewx init my-agent --template researcher

Created my-agent.yaml:
  agents:
    - id: my-agent
      name: "My Custom Agent"
      provider: api/openai
      ...
```

#### **로컬 테스트**
```bash
$ crewx test my-agent.yaml

Testing agent 'my-agent'...
✓ YAML validation passed
✓ Provider configuration valid
✓ Tools available
✓ Test query successful

Ready to publish!
```

#### **배포**
```bash
$ crewx publish my-agent.yaml --access public

Publishing to registry.crewx.ai...
✓ Uploading manifest
✓ Validating dependencies
✓ Creating version 1.0.0

Published successfully!
URL: https://registry.crewx.ai/agents/my-agent
```

---

## 💰 비즈니스 모델

### 1. **Freemium Agents**
```yaml
pricing:
  model: "freemium"
  tiers:
    - name: "Free"
      price: 0
      limits:
        queries_per_month: 100

    - name: "Pro"
      price: 9.99
      limits:
        queries_per_month: 10000
        features: ["priority", "analytics"]
```

### 2. **Revenue Sharing (30/70 split)**
- CrewX 플랫폼: 30%
- 에이전트 개발자: 70%

### 3. **Enterprise Plans**
```yaml
# 기업용 프라이빗 레지스트리
registry:
  type: "enterprise"
  url: "https://agents.mycompany.com"

  # 중앙 레지스트리 미러링
  upstream:
    - "https://registry.crewx.ai"
    sync: true
```

---

## 🚀 로드맵

### **Phase 1: Foundation (현재 ~ WBS-25)**
**목표**: 에이전트 실행 환경 완성

- ✅ WBS-19: API Provider 설계
- 🔄 WBS-20: BaseAPIProvider 구현
- 🔄 WBS-21: MCP 통합
- 🔄 WBS-22: query_agent 도구
- 🔄 WBS-23: YAML 파싱
- 🔄 WBS-24: Agent Factory
- 🔄 WBS-25: 통합 테스트

**완료 조건**:
- [ ] 7가지 Provider 작동
- [ ] Tool injection 완료
- [ ] query_agent로 inter-agent 통신
- [ ] CLI + Slack 양쪽 작동

---

### **Phase 2: Distribution (WBS-26~30)**
**목표**: 에이전트 배포 메커니즘

```yaml
# WBS-26: Registry Client 구현
features:
  - Agent manifest 파싱
  - 의존성 해결 (tools, mcp)
  - 버전 관리 (semver)

# WBS-27: Install Command
$ crewx install <agent-id>[@version]

# WBS-28: Search & Discovery
$ crewx search <keyword>
$ crewx trending --category research

# WBS-29: Update & Uninstall
$ crewx upgrade <agent-id>
$ crewx uninstall <agent-id>

# WBS-30: Local Agent Development
$ crewx init <agent-name> --template <type>
$ crewx test <agent-file>
```

**완료 조건**:
- [ ] npm-like 패키지 관리
- [ ] 의존성 자동 해결
- [ ] 로컬 에이전트 개발 지원

---

### **Phase 3: Marketplace (WBS-31~40)**
**목표**: 중앙 레지스트리 + 마켓플레이스

```yaml
# WBS-31: Registry Server (Backend)
stack:
  - NestJS (API)
  - PostgreSQL (메타데이터)
  - S3 (agent manifests)

# WBS-32: Agent Publishing
$ crewx login
$ crewx publish ./my-agent.yaml --access public

# WBS-33: Web UI (Marketplace)
pages:
  - /agents (검색)
  - /agents/:id (상세)
  - /dashboard (개발자 대시보드)

# WBS-34: Analytics
features:
  - 다운로드 추적
  - 사용량 통계
  - 평점 시스템

# WBS-35: Review System
features:
  - 사용자 리뷰
  - 별점
  - 댓글
```

**완료 조건**:
- [ ] 중앙 레지스트리 운영
- [ ] 웹 UI로 에이전트 검색
- [ ] 개발자 대시보드

---

### **Phase 4: Monetization (WBS-41~50)**
**목표**: 수익화 + Enterprise 기능

```yaml
# WBS-41: Payment Integration
providers:
  - Stripe (신용카드)
  - PayPal (페이팔)

# WBS-42: Subscription Management
features:
  - Free/Pro 티어 관리
  - 사용량 추적
  - 자동 청구

# WBS-43: Revenue Sharing
split:
  platform: 30%
  developer: 70%

# WBS-44: Enterprise Registry
features:
  - 프라이빗 레지스트리
  - SSO 통합
  - On-premise 배포

# WBS-45: Usage Analytics
features:
  - Query 추적
  - 비용 분석
  - 최적화 제안
```

**완료 조건**:
- [ ] 결제 시스템 통합
- [ ] 수익 분배 자동화
- [ ] Enterprise 고객 확보

---

## 🎯 핵심 차별화 요소

### 1. **No-Code Agent Creation**
```yaml
# 비개발자도 YAML만으로 에이전트 생성
agents:
  - id: my-translator
    name: "한영 번역기"
    provider: api/openai
    system_prompt: |
      너는 한국어-영어 전문 번역가야.
    tools: [translate, dictionary]
```

### 2. **Universal Interface**
| 인터페이스 | 타겟 사용자 | 예시 |
|----------|----------|-----|
| CLI | 개발자 | `crewx query "@translator 번역해줘"` |
| Slack | 비개발자 | `/crewx @translator 번역해줘` |
| REST API | 통합 | `POST /api/v1/agents/translator/query` |
| Web UI | 일반 사용자 | `https://app.crewx.ai/translator` |

### 3. **Ecosystem Integration**
```yaml
# MCP 마켓플레이스
mcp:
  - name: github-mcp
    source: registry.crewx.ai/mcp/github
    version: 2.0.0

# Tool 마켓플레이스
tools:
  - name: web-scraper-pro
    source: registry.crewx.ai/tools/scraper
    price: freemium
```

---

## 📊 경쟁사 비교

| 기능 | CrewX | LangGraph | AutoGPT | GPT Store |
|-----|-------|-----------|---------|-----------|
| **타겟 사용자** | 전체 | 개발자 | 개발자 | 일반 사용자 |
| **에이전트 생성** | YAML | Python 코드 | JSON | Web UI |
| **배포 방식** | Registry | GitHub | GitHub | OpenAI |
| **수익화** | ✅ | ❌ | ❌ | ✅ (ChatGPT Plus) |
| **크로스 플랫폼** | CLI/Slack/Web | Python | Python | Web only |
| **Tool 통합** | MCP + Custom | Custom | Plugins | Actions |
| **Multi-Agent** | ✅ | ✅ | ✅ | ❌ |
| **Enterprise** | ✅ (Private registry) | ❌ | ❌ | ❌ |

---

## ✅ 결론

### **CrewX를 계속 가야 하는 이유**

1. **GPT Store보다 유연함**
   - GPT Store: OpenAI에 락인
   - CrewX: 7가지 Provider (OpenAI, Claude, Gemini, ...)

2. **LangGraph보다 쉬움**
   - LangGraph: Python 코딩 필수
   - CrewX: YAML 설정만

3. **AutoGPT보다 실용적**
   - AutoGPT: 자율 에이전트 (통제 어려움)
   - CrewX: 사용자가 직접 호출 (통제 가능)

4. **독자적 생태계 구축 가능**
   - Agent 마켓플레이스
   - MCP 마켓플레이스
   - Tool 마켓플레이스
   - Enterprise 솔루션

---

## 🚀 다음 액션

### **WBS-20부터 앱스토어 관점으로 설계 조정**

1. **Agent Manifest 스키마 추가**
   ```typescript
   // packages/sdk/src/types/agent-manifest.types.ts
   export interface AgentManifest {
     metadata: {
       id: string;
       name: string;
       version: string;
       author: string;
       description: string;
       category: string;
       tags: string[];
     };

     pricing?: {
       model: 'free' | 'freemium' | 'paid';
       tiers: Array<{
         name: string;
         price: number;
         limits: Record<string, any>;
       }>;
     };

     dependencies?: {
       tools?: string[];
       mcp?: string[];
     };

     agent: {
       provider: string;
       model: string;
       system_prompt: string;
       tools?: string[];
       mcp?: string[];
     };
   }
   ```

2. **Registry Client 준비**
   ```bash
   # WBS-26에서 구현
   crewx install <agent-id>
   crewx search <keyword>
   ```

3. **YAML 스키마 확장**
   ```yaml
   # 앱스토어 메타데이터 추가
   metadata:
     id: researcher-pro
     version: 1.0.0
     author: sowon-ai

   agent:
     provider: api/openai
     # ...
   ```

---

**작성자**: Claude (WBS-19 설계 에이전트)
**최종 업데이트**: 2025-11-11
