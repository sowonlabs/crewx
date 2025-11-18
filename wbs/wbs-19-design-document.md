# WBS-19: API Provider 최종 설계

> **목표**: SowonFlow 패턴 기반 CrewX API Provider 설계
> **상태**: 🟡 진행중 (Phase 4 - 의사결정 필요)
> **날짜**: 2025-11-11
> **예상 소요**: 5-7일

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [핵심 설계 철학](#핵심-설계-철학)
3. [Phase 구성](#phase-구성)
4. [주요 변경 사항](#주요-변경-사항)

---

## 프로젝트 개요

### Phase 1-3 완료 상태

| Phase | 산출물 | 상태 |
|-------|--------|------|
| Phase 1 | Architecture Diagram | ✅ 완료 |
| Phase 2 | SowonFlow Spec Analysis | ✅ 완료 |
| Phase 3 | TypeScript Types, Zod Schemas | ⚠️ 수정 필요 |

### 주요 변경 사항 (v2)

**피드백 반영**:
1. ❌ YAML HTTP tool 정의 → ✅ **Function injection 패턴**
2. ❌ `gateway` 용어 → ✅ `url` 용어 사용
3. ❌ Provider 3종류 → ✅ **7종류** (openai, anthropic, google, bedrock, litellm, ollama, sowonai)
4. ❌ Tools string array → ✅ **include/exclude 패턴**
5. ❌ MCP만 include/exclude → ✅ **Tools도 include/exclude**

---

## 핵심 설계 철학

### 1. Framework Philosophy

CrewX는 **라이브러리가 아니라 프레임워크**:
- ❌ Wrong: YAML에 모든 것 정의 (정적)
- ✅ Right: TypeScript로 확장 (동적)

### 2. Tool Injection Pattern (SowonFlow 방식)

```typescript
// ✅ Right: TypeScript로 function 주입
const companySearchTool = tool({
  name: 'company_search',
  execute: async ({ query }) => {
    return await myAPI.search(query);
  },
});

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [companySearchTool],  // ← Function injection!
});
```

### 3. YAML은 선언만, Code는 구현

| 항목 | YAML (선언적) | TypeScript (구현) |
|------|---------------|-------------------|
| MCP Servers | ✅ 설정 | ✅ MCP 클라이언트 연결 |
| Tools | ✅ 활성화 (include/exclude) | ✅ Tool 구현 (function injection) |
| Agents | ✅ 구성 | ✅ Agent 생성 및 실행 |

---

## Phase 구성

### 일정: 5-7일

| Phase | 작업 | 소요 | 산출물 | 상세 문서 |
|-------|------|------|--------|-----------|
| Phase 1 | 아키텍처 설계 | 1일 | Architecture Diagram | [Phase 1 상세](wbs-19-architecture-diagram.md) |
| Phase 2 | SowonFlow 분석 | 1일 | Spec Analysis | [Phase 2 상세](wbs-19-sowonflow-spec-analysis.md) |
| Phase 3 | 타입 시스템 설계 | 1-2일 | TS Types, Zod Schemas | [Phase 3 상세](wbs-19-phase-3-types.md) |
| Phase 4 | 의사결정 | 1일 | 최종 설계 문서 | [Phase 4 상세](wbs-19-phase-4-decisions.md) |
| Phase 5 | 구현 가이드라인 | 1-2일 | 구현 예시, 문서 | [Phase 5 상세](wbs-19-phase-5-implementation.md) |

### Phase 1: 아키텍처 설계 (1일)
- CrewX Provider 아키텍처 다이어그램
- CLI Provider vs API Provider 비교
- Tool/MCP 통합 구조

### Phase 2: SowonFlow 분석 (1일)
- WorkflowOptions 패턴 분석
- Tool merging 전략
- YAML 구조 분석

### Phase 3: 타입 시스템 설계 (1-2일)
- APIProviderConfig 타입 정의
- ToolExecutionContext 설계
- Zod 스키마 작성

### Phase 4: 의사결정 (1일)
- Mode별 tool 분리 (query vs execute)
- YAML spec 통일성
- Function injection 패턴 확정

### Phase 5: 구현 가이드라인 (1-2일)
- 7가지 Provider 구현 예시
- agent_call 내장 툴 설계
- 문서화 및 예제 코드

---

## 의사결정 포인트

### 1. YAML spec 통일 vs 분리

**질문**: CLI Provider와 API Provider의 YAML spec을 통일할 것인가?

**옵션**:
- A) 단일 spec (tools 필드만 사용)
- B) 이중 spec (tools_query, tools_execute)

**권장**: A (단일 spec) - 단순성, 일관성

### 2. Function injection 패턴

**확정**:
- Tools는 TypeScript로만 정의 (YAML 제외)
- YAML은 tool 이름만 include/exclude로 활성화
- Context 전달 (vars, env, agent 정보 접근)

### 3. 7가지 Provider 지원

**확정**:
- api/openai, api/anthropic, api/google
- api/bedrock, api/litellm, api/ollama
- **api/sowonai** (자체 서비스)

---

## 성공 기준

### Phase 1-3
- ✅ Architecture Diagram 완성
- ✅ SowonFlow 패턴 분석 완료
- ⚠️ TypeScript Types 수정 필요

### Phase 4-5
- ⬜ 의사결정 문서 완성
- ⬜ 7가지 Provider 구현 가이드라인
- ⬜ agent_call 내장 툴 설계
- ⬜ 전체 문서화 완료

---

## 다음 단계

1. **Phase 4 의사결정 완료** → 최종 spec 확정
2. **Phase 5 구현 가이드** → WBS-20 구현 착수
3. **WBS-20 연동** → 실제 Provider 구현

---

## 참고 문서

- [Phase 1: Architecture Diagram](wbs-19-architecture-diagram.md)
- [Phase 2: SowonFlow Spec Analysis](wbs-19-sowonflow-spec-analysis.md)
- [Phase 3: Type System](wbs-19-phase-3-types.md)
- [Phase 4: Design Decisions](wbs-19-phase-4-decisions.md)
- [Phase 5: Implementation Guide](wbs-19-phase-5-implementation.md)
- [Compatibility Principles](wbs-19-compatibility-principles.md)
- [AppStore Vision](wbs-19-appstore-vision.md)
