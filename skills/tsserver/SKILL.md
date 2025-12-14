---
name: tsserver
description: TypeScript/JavaScript 코드 분석 도구. 심볼 검색, 정의 이동, 참조 찾기, 타입 정보 등 IDE 수준의 코드 인텔리전스 제공.
version: 0.3.0
---

# tsserver Skill

VSCode가 내부적으로 사용하는 tsserver를 CLI에서 직접 호출하여 TypeScript/JavaScript 코드를 분석합니다.

## 설치

```bash
cd skills/tsserver
npm install
```

- Node.js 16+
- `tsconfig.json` 권장

## VSCode/Cursor 사용자라면?

이미 IDE에서 같은 기능을 쓰고 있어요:

| 이 스킬 명령어 | VSCode/Cursor 단축키 |
|---------------|---------------------|
| `find` | `Cmd+T` (Go to Symbol in Workspace) |
| `definition` | `F12` 또는 `Cmd+Click` |
| `references` | `Shift+F12` |
| `symbols` | `Cmd+Shift+O` (Outline) |
| `quickinfo` | 마우스 호버 |
| `diagnostics` | Problems 패널 (`Cmd+Shift+M`) |

**이 스킬이 필요한 경우:**
- AI 에이전트가 코드 분석할 때 (CLI 환경)
- 스크립트에서 자동화할 때
- IDE 없이 터미널에서 작업할 때

## 핵심 원리

```
VSCode/Cursor  ──────►  tsserver  ◄──────  이 스킬 (CLI)
                            │
                      JSON Protocol
                      (stdin/stdout)
```

> VSCode, Cursor 모두 내부적으로 tsserver를 사용합니다.
> 이 스킬은 동일한 tsserver를 CLI에서 직접 호출합니다.

## 추천 명령어 (심볼 이름으로 검색)

line/column 몰라도 됨!

```bash
# 프로젝트 전체에서 심볼 검색
node skills/tsserver/tsserver.js find <symbol>

# 파일 내 심볼의 타입 정보
node skills/tsserver/tsserver.js info <file> <symbol>

# 파일 구조 (모든 심볼 목록)
node skills/tsserver/tsserver.js symbols <file>
```

### 예시

```bash
# BaseAIProvider 클래스 찾기
$ node skills/tsserver/tsserver.js find BaseAIProvider
{
  "found": true,
  "count": 3,
  "symbols": [
    { "name": "BaseAIProvider", "kind": "class", "file": ".../base-ai.provider.ts", "line": 32 },
    { "name": "BaseAIProvider", "kind": "alias", "file": ".../index.ts", "line": 1 }
  ]
}

# 특정 파일에서 ClaudeProvider 타입 정보
$ node skills/tsserver/tsserver.js info src/providers/claude.ts ClaudeProvider
{
  "found": true,
  "symbol": "ClaudeProvider",
  "location": { "file": "...", "line": 5, "column": 14 },
  "typeInfo": {
    "kind": "class",
    "displayString": "class ClaudeProvider"
  }
}
```

## line/column 기반 명령어

정확한 위치를 알 때 사용:

```bash
# 정의로 이동 (Go to Definition)
node skills/tsserver/tsserver.js definition <file> <line> <column>

# 모든 참조 찾기 (Find All References)
node skills/tsserver/tsserver.js references <file> <line> <column>

# 타입 정보 (Hover)
node skills/tsserver/tsserver.js quickinfo <file> <line> <column>

# 타입 정의로 이동
node skills/tsserver/tsserver.js typeDefinition <file> <line> <column>

# 구현으로 이동 (인터페이스 → 클래스)
node skills/tsserver/tsserver.js implementation <file> <line> <column>
```

## 파일 단위 명령어

```bash
# 파일 내 모든 심볼 (Outline)
node skills/tsserver/tsserver.js symbols <file>

# 에러/경고 진단
node skills/tsserver/tsserver.js diagnostics <file>
```

## 코드 분석 워크플로우

```
1. find <symbol>     → 프로젝트에서 심볼 위치 찾기
2. info <file> <sym> → 해당 파일에서 타입 정보 확인
3. symbols <file>    → 파일 구조 파악
4. references ...    → 사용처 추적 (line/column 필요)
```

## 지원 명령어 (ts.server.protocol.CommandTypes)

| 명령어 | VSCode 동등 기능 | line/col 필요 |
|--------|------------------|---------------|
| `find` | Ctrl+T (Go to Symbol) | ❌ |
| `info` | 마우스 호버 | ❌ |
| `symbols` | Outline 패널 | ❌ |
| `definition` | F12 | ✅ |
| `references` | Shift+F12 | ✅ |
| `quickinfo` | 호버 | ✅ |
| `implementation` | Ctrl+F12 | ✅ |
| `diagnostics` | Problems 패널 | ❌ |

## 한계

1. **TypeScript/JavaScript 전용**
2. **모노레포**: `find`는 하나의 tsconfig 범위만 검색 (SDK ↔ CLI 별도)
3. **시작 시간**: ~500ms (tsserver 초기화)

## 관련 문서

- [tsserver Wiki](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver))
- [tsserver-example](https://github.com/mmorearty/tsserver-example)
