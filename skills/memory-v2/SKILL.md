---
name: memory-v2
description: 마크다운 + 프론트매터 기반 장기 기억 스킬. 드릴다운 구조로 확장성 있는 기억 관리.
version: 0.4.1
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
node skills/memory-v2/memory-v2.js save <agent_id> "<summary>" [category] [--topic=xxx] [--tags=a,b,c] [--body="상세 내용"]
```

**옵션:**
| 옵션 | 설명 | 예시 |
|------|------|------|
| `category` | 기억 분류 | decision, task, project, schedule, context, preference, general |
| `--topic` | 토픽 그룹 | `--topic=crewx-strategy` |
| `--tags` | 태그 (쉼표 구분) | `--tags=gemini,pricing` |
| `--body` | **상세 내용 (권장!)** | `--body="배경, 근거, 결정사항 등"` |

**⚠️ 중요: `--body` 옵션을 반드시 사용하세요!**
- `--body` 없으면 플레이스홀더만 저장됨
- 나중에 맥락 파악이 어려워짐
- 최소 1-2문장 이상 상세 내용 권장

**예시:**
```bash
# ❌ 나쁜 예 - 상세 없음
node skills/memory-v2/memory-v2.js save cto "Gemini 3.0 Flash 모먼트" decision --topic=crewx-strategy

# ✅ 좋은 예 - 상세 포함
node skills/memory-v2/memory-v2.js save cto "Gemini 3.0 Flash 모먼트 - 전략적 분기점" decision --topic=crewx-strategy --tags=gemini,pricing --body="SWE-bench 78%로 Claude 3.5 Sonnet(49%) 압도. 가격은 1/6. CrewX 전략 검증됨 - 오케스트레이션이 핵심 해자."
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

### 키워드 검색 (빠름)

```bash
node skills/memory-v2/memory-v2.js find <agent_id> "<keyword>"
```

grep 기반 문자열 매칭. 빠르고 무료.

### 시맨틱 검색 (AI)

```bash
node skills/memory-v2/memory-v2.js search <agent_id> "<질문>"
```

**Gemini 2.0 Flash** 기반 시맨틱 검색. 유사어/맥락 이해.

- 스킬 내부 `@memory_searcher` 에이전트 사용 (crewx.yaml)
- 비용: ~$0.015/1M tokens (거의 무료)

**예시:**
```bash
# 키워드 검색 (빠름)
node memory-v2.js find crewx_dev_lead "에이전트"

# 시맨틱 검색 (AI)
node memory-v2.js search crewx_dev_lead "작업 배정할 때 주의할 점"
```

### 상세 조회 (드릴다운)

```bash
node skills/memory-v2/memory-v2.js get <agent_id> <memory_id>
```

### 기억 수정 (update)

```bash
node skills/memory-v2/memory-v2.js update <agent_id> <memory_id> [옵션]
```

**옵션:**
| 옵션 | 설명 |
|------|------|
| `--summary` | 요약 수정 |
| `--body` | 상세 내용 수정 |
| `--topic` | 토픽 변경 |
| `--category` | 카테고리 변경 |
| `--tags` | 태그 변경 (쉼표 구분) |

**예시:**
```bash
# 요약과 상세 내용 수정
node skills/memory-v2/memory-v2.js update cto VkY9X6 --summary="수정된 요약" --body="수정된 상세 내용"

# 토픽만 변경
node skills/memory-v2/memory-v2.js update cto VkY9X6 --topic=new-topic
```

### 기억 삭제 (delete)

```bash
node skills/memory-v2/memory-v2.js delete <agent_id> <memory_id> [--force]
```

- `--force` 없으면 확인 메시지만 출력
- `--force` 있으면 실제 삭제

**예시:**
```bash
# 삭제 확인
node skills/memory-v2/memory-v2.js delete cto VkY9X6

# 실제 삭제
node skills/memory-v2/memory-v2.js delete cto VkY9X6 --force
```

### 기억 병합 (merge)

```bash
node skills/memory-v2/memory-v2.js merge <agent_id> <memory_id1> <memory_id2> [--summary="병합 요약"]
```

- 두 기억을 하나로 병합
- 원본 두 기억은 삭제됨
- 태그는 합쳐짐 (중복 제거)
- 병합된 파일에 `merged_from` 메타데이터 추가

**예시:**
```bash
# 두 기억 병합
node skills/memory-v2/memory-v2.js merge cto abc123 def456

# 커스텀 요약으로 병합
node skills/memory-v2/memory-v2.js merge cto abc123 def456 --summary="VLM 파인튜닝 종합 정리"
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

## 저장 명령 (--body 필수!)
```bash
# ⚠️ 항상 --body 포함해서 저장!
node skills/memory-v2/memory-v2.js save {{agent_id}} "<요약>" <category> --topic=<topic> --body="<상세 내용>"
```

**--body 작성 가이드:**
- 왜 이 결정을 했는지 (배경/근거)
- 핵심 수치나 데이터
- 관련 파일/문서 경로
- 후속 액션이 있으면 포함

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

## v1 → v2 마이그레이션

```bash
node skills/memory-v2/migrate.js <agent_id>
```
