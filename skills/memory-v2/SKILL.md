---
name: memory-v2
description: 마크다운 + 프론트매터 기반 장기 기억 스킬. 드릴다운 구조로 확장성 있는 기억 관리.
version: 0.2.1
---

# Memory V2 Skill

마크다운 + 프론트매터 기반의 장기 기억 관리 스킬입니다.

## 설치

```bash
cd skills/memory-v2
npm install
```

**의존성:**
- `gray-matter`: 프론트매터 파싱
- `nanoid`: 6자리 고유 ID 생성

## 특징

- **프론트매터**: 메타데이터 분리 (날짜, 카테고리, 태그, 토픽)
- **드릴다운**: index.md → entries/ 구조
- **가독성**: 사람이 직접 읽고 편집 가능
- **Git 친화적**: 개별 파일로 버전 관리

## 디렉토리 구조

```
skills/memory-v2/
├── SKILL.md              # 이 문서
├── memory-v2.js          # CLI 인터페이스
├── TEMPLATE.md           # 기억 템플릿
└── data/
    └── {agent_id}/
        ├── index.md      # 인덱스 (요약 + 링크)
        └── entries/      # 개별 기억들
            └── 2025-12-23-topic-name.md
```

## 명령어

### 저장

```bash
node skills/memory-v2/memory-v2.js save <agent_id> "<summary>" [category] [--topic=xxx] [--tags=a,b,c]
```

**카테고리**: decision, schedule, task, project, context, preference, general (기본값)

**예시:**
```bash
node skills/memory-v2/memory-v2.js save cto "Gemini 3.0 Flash 모먼트 - 전략적 분기점" decision --topic=crewx-strategy --tags=gemini,pricing
```

### 인덱스 조회

```bash
node skills/memory-v2/memory-v2.js index <agent_id>
```

### 토픽 드릴다운

```bash
node skills/memory-v2/memory-v2.js topic <agent_id> <topic_name>
```

### 최근 기억

```bash
node skills/memory-v2/memory-v2.js recent <agent_id> [days=30]
```

### 검색

```bash
node skills/memory-v2/memory-v2.js find <agent_id> "<keyword>"
```

### 상세 조회 (드릴다운)

```bash
node skills/memory-v2/memory-v2.js get <agent_id> <memory_id>
```

## 프론트매터 스키마

```yaml
---
id: yLC8Iv  # nanoid 6자리
date: 2025-12-23
category: decision
tags: ["strategy", "gemini"]
topic: crewx-strategy
summary: "한 줄 요약"
---
```

## 에이전트 프롬프트 가이드

```markdown
<memory-v2-guide agent_id="{{agent_id}}">
# Memory V2 사용 가이드

## 대화 시작 시 (필수!)
```bash
# 인덱스 확인 (토픽 목록도 확인됨)
node skills/memory-v2/memory-v2.js index {{agent_id}}

# 필요시 토픽 드릴다운
node skills/memory-v2/memory-v2.js topic {{agent_id}} <topic_name>
```

## 기억 저장 트리거
- "기억해둬", "저장해", "메모해" 요청 시
- 중요한 결정사항 발생 시
- CEO 지침 수령 시

## 토픽 선택 가이드 ⭐

**저장 시 반드시 적절한 토픽을 지정하세요!**

1. **기존 토픽 확인**: `index` 명령으로 기존 토픽 목록 확인
2. **기존 토픽 선택**: 관련 토픽이 있으면 그 토픽 사용
3. **새 토픽 생성**: 없으면 새 토픽명 생성 (kebab-case, 예: `new-feature`)

**토픽 네이밍 규칙:**
- kebab-case 사용 (예: `vlm-finetuning`, `crewx-strategy`)
- 프로젝트/기능/주제 단위로 묶기
- 너무 세분화하지 말 것 (5개 미만이면 병합 고려)

**예시:**
```bash
# 기존 토픽에 추가
node skills/memory-v2/memory-v2.js save {{agent_id}} "VLM 학습률 조정" decision --topic=vlm-finetuning

# 새 토픽 생성
node skills/memory-v2/memory-v2.js save {{agent_id}} "신규 기능 기획" decision --topic=new-feature-x
```

## 저장 명령
```bash
# 요약만
node skills/memory-v2/memory-v2.js save {{agent_id}} "<요약>" <category> --topic=<topic>

# 요약 + 상세
node skills/memory-v2/memory-v2.js save {{agent_id}} "<요약>" <category> --topic=<topic> --body="<상세 내용>"
```

## 카테고리 선택
- **decision**: 의사결정, CEO 지침
- **task**: 할 일, 작업 계획
- **project**: 프로젝트 정보
- **schedule**: 일정, 미팅
- **context**: 배경 정보, 상황
- **preference**: 선호도, 규칙
- **general**: 기타

</memory-v2-guide>
```

## 기존 memory 스킬과 차이점

| 항목 | memory (v1) | memory-v2 |
|------|-------------|-----------|
| 저장 형식 | JSON 배열 | 마크다운 파일 |
| 메타데이터 | content 내 혼합 | 프론트매터 분리 |
| 조회 | 전체 로드 | 인덱스 → 드릴다운 |
| 토픽 지원 | 없음 | 있음 |
| 가독성 | 낮음 | 높음 |

## 버전 히스토리

| 버전 | 변경사항 |
|------|----------|
| v0.2.0 | nanoid 6자리 ID, get 드릴다운, index.md 제거(실시간 스캔), gray-matter |
| v0.1.0 | 초기 버전 - save, index, topic, recent, find |
