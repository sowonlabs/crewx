---
name: search-bm25
description: BM25 기반 문서/코드 검색 스킬. grep보다 똑똑한 검색 - 복합 키워드, 점수 정렬, 의미 기반 매칭.
version: 0.1.0
---

# Search BM25 Skill

grep보다 똑똑한 BM25 기반 검색. 복합 키워드를 이해하고 관련성 점수로 정렬.

## When to Use This Skill

- 문서에서 특정 주제 찾을 때
- 코드베이스에서 관련 파일 찾을 때
- grep으로 정확히 못 찾을 때
- 여러 키워드 조합 검색할 때

## Setup

```bash
cd skills/search-bm25
npm install
```

**Dependencies:**
- wink-bm25-text-search (BM25 검색 엔진)
- wink-nlp-utils (토크나이저, 스테밍)
- gray-matter (마크다운 frontmatter 파싱)
- glob (파일 패턴 매칭)

## Quick Start

```bash
# 마크다운 검색 (기본)
node skills/search-bm25/search.js "런처 아키텍처" .

# 특정 디렉토리
node skills/search-bm25/search.js "API endpoint" ./docs

# JS/TS 파일 검색
node skills/search-bm25/search.js "authentication" ./src --glob="**/*.{js,ts}"

# 결과 개수 제한
node skills/search-bm25/search.js "error handling" . --limit=10

# JSON 출력
node skills/search-bm25/search.js "database" . --json
```

## Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--glob=<pattern>` | 파일 패턴 | `**/*.md` |
| `--limit=<n>` | 결과 개수 제한 | 20 |
| `--json` | JSON 형식 출력 | false |

## grep vs search

| | grep | search |
|--|------|--------|
| 정확한 문자열 | ✅ | ✅ |
| 복합 키워드 | ❌ | ✅ |
| 점수 정렬 | ❌ | ✅ |
| 의미 유사 | ❌ | △ (BM25) |
| 한글 검색 | ✅ | ✅ |

## Examples

### 문서 검색
```bash
# CrewX 런처 관련 문서 찾기
node skills/search-bm25/search.js "CrewX launcher electron architecture" ./docs

# 결과:
# [17.5점] docs/launcher/architecture.md
# [12.3점] docs/decisions/2025-12-24-launcher.md
```

### 코드 검색
```bash
# API 인증 관련 코드 찾기
node skills/search-bm25/search.js "authentication JWT token" ./src --glob="**/*.ts"

# 결과:
# [15.2점] src/auth/jwt.service.ts
# [10.8점] src/middleware/auth.middleware.ts
```

### 한글 검색
```bash
# 에러 처리 관련 찾기
node skills/search-bm25/search.js "에러 처리 예외" . --glob="**/*.md"

# 결과:
# [3점] docs/troubleshooting.md
# [2점] docs/error-handling.md
```

## How It Works

1. **파일 수집**: glob 패턴으로 대상 파일 찾기
2. **인덱싱**: 각 파일 내용을 BM25 엔진에 등록
3. **검색**: 쿼리를 토큰화하고 점수 계산
4. **정렬**: 관련성 점수 높은 순으로 출력

### 점수 계산 (BM25)
- **TF (Term Frequency)**: 단어 빈도
- **IDF (Inverse Document Frequency)**: 희귀 단어일수록 높은 점수
- **문서 길이 보정**: 짧은 문서에서 매칭되면 더 의미있음

## Tips

1. **키워드 많이 넣기**: BM25는 부분 매칭도 점수화
   ```bash
   # 좋음: 관련 키워드 여러 개
   search "API authentication JWT refresh token"

   # 나쁨: 단어 하나만
   search "API"
   ```

2. **한글+영어 혼합 가능**
   ```bash
   search "런처 Electron Tauri 아키텍처"
   ```

3. **결과 많으면 limit 조절**
   ```bash
   search "config" . --limit=5
   ```
