---
name: meeting
description: CrewX 에이전트들과 회의하는 방법. crewx q + thread 기능으로 맥락 유지하며 대화.
version: 0.1.0
---

# Meeting Skill

CrewX 에이전트들과 회의하는 스킬입니다. 코드 설치 없이 crewx 기본 기능만 사용합니다.

## 핵심 개념

**회의 = crewx q + --thread**

- `crewx q "@에이전트 메시지"` - 에이전트에게 질문/지시
- `--thread="회의명"` - 같은 스레드면 이전 대화 맥락 유지

## 기본 사용법

### 1. 단일 에이전트 회의

```bash
# 첫 번째 대화 (스레드 시작)
crewx q "@cmo 후기 인센티브 마케팅 논의하자" --thread="2025-12-27-marketing"

# 이어서 대화 (같은 스레드)
crewx q "@cmo 그럼 5만원 인센티브 비용 대비 효과는?" --thread="2025-12-27-marketing"

# 계속 이어가기
crewx q "@cmo 결론 정리해줘" --thread="2025-12-27-marketing"
```

### 2. 다중 에이전트 순차 회의

```bash
# CMO에게 먼저 마케팅 검토 요청
crewx q "@cmo 후기 인센티브 마케팅 PRD 검토해줘" --thread="2025-12-27-review-incentive"

# CTO에게 기술 구현 검토 요청 (같은 스레드)
crewx q "@cto CMO 의견 봤어? 기술적으로 구현 가능한지 검토해줘" --thread="2025-12-27-review-incentive"

# CPO에게 최종 결정 요청
crewx q "@cpo CMO, CTO 의견 종합해서 PRD에 반영할지 결정해줘" --thread="2025-12-27-review-incentive"
```

### 3. 임원 회의 패턴 (C-Level Meeting)

```bash
# 안건 브리핑
crewx q "@cto 런처 MVP 진행 상황 브리핑해줘" --thread="2025-12-27-exec-meeting"
crewx q "@cmo 마케팅 전략 브리핑해줘" --thread="2025-12-27-exec-meeting"
crewx q "@cpo 제품 로드맵 브리핑해줘" --thread="2025-12-27-exec-meeting"

# 토론
crewx q "@cto CMO 의견에 대해 기술적 관점에서 코멘트해줘" --thread="2025-12-27-exec-meeting"

# 결론 도출
crewx q "@cpo 오늘 회의 결론 정리하고 액션 아이템 뽑아줘" --thread="2025-12-27-exec-meeting"
```

## 스레드 네이밍 컨벤션

```
YYYY-MM-DD-주제
```

**예시:**
- `2025-12-27-marketing-review` - 마케팅 리뷰
- `2025-12-27-launcher-mvp` - 런처 MVP 논의
- `2025-12-27-exec-meeting` - 임원 회의
- `2025-12-27-cmo-brainstorm` - CMO와 브레인스토밍

## 회의 기록 확인

```bash
# 스레드 목록 확인
crewx thread ls

# 특정 스레드 내용 보기
crewx thread show "2025-12-27-marketing"
```

## 사용 가능한 에이전트

```bash
# 현재 사용 가능한 에이전트 목록
crewx agent ls
```

**주요 에이전트:**
- `@cto` - 기술 전략, 아키텍처
- `@cmo` - 마케팅, 홍보
- `@cpo` - 제품 기획, PRD
- `@jarvis` - 개인 비서
- `@crewx_dev_claude` - CrewX 개발

## 팁

### 맥락 전달하기

에이전트는 같은 스레드 내 이전 대화를 기억함. 하지만 다른 스레드 내용은 모름.

```bash
# 다른 에이전트에게 이전 논의 결과 전달할 때
crewx q "@cto CMO가 후기 인센티브로 5만원 제안했어. 기술적으로 자동화 가능해?" --thread="2025-12-27-review"
```

### 긴 내용 전달하기

```bash
# 파일 내용 참조하게 하기
crewx q "@cpo docs/cpo/launcher/crewx-launcher-prd.md 읽고 후기 인센티브 섹션 추가해줘" --thread="2025-12-27-prd-update"
```

### 회의 마무리

```bash
# 회의 결론 요청
crewx q "@cpo 오늘 논의 내용 요약하고 액션 아이템 정리해줘" --thread="2025-12-27-meeting"

# 메모리에 저장하게 하기
crewx q "@cpo 오늘 결정사항 메모리에 저장해줘" --thread="2025-12-27-meeting"
```

## CTO가 회의 주재할 때

CEO가 "회의하자"라고 하면:

1. 이 스킬 읽기
2. 회의 주제 파악
3. 관련 에이전트 선정 (CMO, CPO, 개발팀 등)
4. 스레드 생성해서 순차적으로 의견 수렴
5. 결론 정리 및 액션 아이템 도출

```bash
# 예: CEO가 "마케팅 전략 회의하자"라고 하면
crewx q "@cmo 현재 마케팅 전략 브리핑해줘" --thread="2025-12-27-marketing-strategy"
crewx q "@cpo 제품 관점에서 마케팅 우선순위 의견 줘" --thread="2025-12-27-marketing-strategy"
# ... CTO가 기술 관점 코멘트
# 결론 정리
```
