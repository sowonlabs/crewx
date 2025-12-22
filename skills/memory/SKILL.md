---
name: memory
description: 장기 기억 저장/조회 스킬. 에이전트가 중요한 정보를 기억하고 나중에 꺼내올 수 있게 해줌.
version: 0.6.0
---

# Memory Skill

에이전트가 **장기 기억**을 관리할 수 있게 해주는 스킬입니다.

## 메모리 구조 (Human-like)

```
{agent_id}.json         → 6개월 raw + 이전 월별 요약 (기본 검색 대상)
{agent_id}.archive.json → 6개월+ raw 원본 (상세 검색용)
```

## 파일 구조

```
skills/memory/
├── memory.js         # 외부 에이전트용 Facade
├── sql.js            # 내부 로직
├── memory-daemon.js  # 백그라운드 압축 데몬
├── crewx.yaml        # memory_agent 설정
└── data/             # 저장소
    ├── {agent_id}.json
    ├── {agent_id}.archive.json
    └── usage.log
```

## 외부 에이전트용 (memory.js)

CTO, CSO, CLO, Jarvis 등 실사용 에이전트가 사용합니다.

### 저장

```bash
node skills/memory/memory.js save <agent_id> "<content>" [category]
```

**카테고리**: preference, project, decision, task, schedule, context, general
(생략 시 general)

**예시:**
```bash
node skills/memory/memory.js save jarvis "투자자 미팅 12월 15일 오후 3시" schedule
node skills/memory/memory.js save cto "CrewX v2.0 TypeScript로 리팩토링 결정" decision
node skills/memory/memory.js save clo "메모리 스킬 테스트 완료" task
```

### 조회

```bash
# 전체 조회
node skills/memory/memory.js list <agent_id>

# 키워드 검색
node skills/memory/memory.js find <agent_id> "<keyword>"

# 최근 30일
node skills/memory/memory.js recent <agent_id>

# 아카이브 조회 (6개월+ 원본)
node skills/memory/memory.js archive <agent_id> [period]
# period: YYYY-MM 또는 all
```

### 자연어 쿼리 (복잡한 질문)

```bash
node skills/memory/memory.js ask <agent_id> "<자연어 질문>"
```

## 주의사항

1. **민감 정보 주의**: 비밀번호, API 키 등 저장하지 말 것
2. **삭제 불가**: 기억은 영구 저장됨 (안전성)
3. **agent_id 필수**: 각 에이전트별로 분리 저장
4. **6개월 윈도우**: 오래된 기억은 자동으로 월별 요약으로 압축됨

## 버전 히스토리

| 버전 | 변경사항 |
|------|----------|
| v0.6.0 | Human-like 메모리: 6개월 윈도우, 월별 요약, 아카이브 |
| v0.5.0 | 파일 구조 정리: memory.js(외부), sql.js(내부) |
| v0.4.0 | 외부/내부 사용법 분리 |
| v0.3.0 | SQL 쿼리 지원 |
