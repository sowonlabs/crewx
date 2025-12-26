# Memory V2

마크다운 + 프론트매터 기반 장기 기억 스킬

## 버전

**현재: v0.4.1**

## 설치

```bash
cd skills/memory-v2
npm install
```

### 의존성

- `gray-matter`: 프론트매터 파싱
- `nanoid`: 6자리 고유 ID 생성

## 사용법

에이전트용 사용 가이드는 [SKILL.md](./SKILL.md) 참고.

## 변경 이력

### v0.4.1 (2025-12-26)
- `recent` 명령에 📄 아이콘 추가 (상세 내용 유무 표시)
- `index`와 동일하게 hasBody 여부 시각화

### v0.4.0 (2025-12-26)
- `update` 명령 추가: 기억 수정 (summary, body, topic, category, tags)
- `delete` 명령 추가: 기억 삭제 (--force 옵션)
- `merge` 명령 추가: 두 기억 병합

### v0.3.0 (2025-12-23)
- 시맨틱 검색 (`search`) 추가 - Gemini 2.0 Flash 기반
- 키워드 검색 (`find`) 추가 - grep 기반

### v0.2.0 (2025-12-23)
- 토픽 드릴다운 (`topic`) 추가
- 인덱스에 토픽별 그룹핑

### v0.1.0 (2025-12-22)
- 초기 버전
- 마크다운 + 프론트매터 구조
- save, index, recent, get 명령

## 마이그레이션

v1 (JSON) → v2 (마크다운) 마이그레이션:

```bash
node skills/memory-v2/migrate.js <agent_id>
```

## 개발

```bash
# 테스트
node memory-v2.js index <agent_id>

# 린트 (프로젝트 루트에서)
npm run lint
```

## 라이선스

Internal - SowonLabs
