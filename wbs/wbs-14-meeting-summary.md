# WBS-14 회의 요약: StructuredPayload/TemplateContext 통합
> **날짜**: 2025-10-19
> **참석**: 팀장 + @crewx_claude_dev, @crewx_codex_dev, @crewx_glm_dev
> **스레드**: thread-0001

---

## 📊 핵심 결론

### ✅ 최종 결정안
**"Codex Option 1 + GLM 즉시 제거" 하이브리드**

- **Phase 1**: 안전 검증 (1일) - Codex의 3가지 실패 모드 테스트
- **Phase 2**: 하드코딩 제거 (1일) - GLM 권고, 회귀 테스트 포함
- **Phase 3**: SDK 확장 (1일) - TemplateContext 공개 + agentMetadata
- **Phase 4**: 문서화 (1일) - Context Integration Standard

**전체 소요**: 최대 4일 (병목 시 자동 연장)

---

## 🎤 개발자 분석

### Codex: 전략적 분석 (상세 분석 완료)

**3가지 실패 모드**:
1. Inline 에이전트 손실 (layout 없는 에이전트)
2. SDK 타입 고정화 (platform enum)
3. 표현 발산 (XML + plaintext 이중 관리)

**권장 경로**: Option 1 (점진적 가드레일 + 모니터링)

**장기 로드맵**: 6개월(SDK 채택) → 2년(Layout-or-Nothing 수렴)

### GLM: 실용 권고 (핵심 답변)

- ❌ 하드코딩: 완전한 중복
- ✅ TemplateContext 부분 공개: CLI 특정 필드 제거 필요
- ✅ RenderContext: 이미 공개됨

**권고**: 즉시 제거 가능 (레이아웃이 이미 처리)

---

## 📋 실행 계획

| Phase | 내용 | 담당 | 소요 |
|-------|------|------|------|
| 1 | 안전 검증 테스트 (Inline/Minimal layout) | Claude + Codex | 1일 |
| 2 | crewx.tool.ts 라인 679-683, 960-964 제거 | Claude | 1일 |
| 3 | SDK TemplateContext 타입 생성 + export | GLM | 1일 |
| 4 | 아키텍처 문서 + DSL 가이드 + 마이그레이션 | Claude | 1일 |

---

## 🔗 참고 링크

- **상세 계획**: [wbs/wbs-14-context-integration.md](../wbs/wbs-14-context-integration.md)
- **문제 코드**:
  - [crewx.tool.ts:679-683](../packages/cli/src/crewx.tool.ts#L679-L683)
  - [crewx.tool.ts:960-964](../packages/cli/src/crewx.tool.ts#L960-L964)
- **WBS 현황**: [wbs.md](../wbs.md#wbs-14)
