# MCP Tool Bridge 사양 (Draft)

> 목적: CrewX 밖의 MCP 서버(내부팀/다른 프로젝트/서드파티)의 툴을 CrewX CLI에서 일관되게 탐색·호출하기 위한 표준 CLI와 설정을 정의한다. 현재 제품의 call_tool 미지원 한계를 우회하며, 장차 정식 통합의 기반을 만든다.

---

## 1. 목표와 비범위

- 목표
  - 외부 MCP 서버의 툴을 `crewx` CLI로 나열(list)·호출(call)한다.
  - 서버 프로필을 `mcp.json`으로 관리하고, 토큰/헤더/타임아웃을 안전하게 주입한다.
  - 기존 CrewX 내부 MCP와 동일한 사용자 경험(UX)과 로깅/종료코드 규칙을 유지한다.
- 비범위 (초기 버전)
  - STDIO 기반 원격 호출(로컬 프로세스 브릿지) 제외 — HTTP만 지원
  - 스트리밍 이벤트 처리 제외(단건 응답)
  - Slack 자동 툴호출/에이전트 자동 툴 선택 제외(후속 단계)

---

## 2. 용어

- MCP 서버: Model Context Protocol을 HTTP(JSON-RPC)로 노출하는 서버
- MCP 툴: `tools/list`, `tools/call`로 노출되는 원격 기능 단위
- 서버 프로필: `mcp.json` 내 원격 서버 연결정보 한 건

---

## 3. 사용자 시나리오 (User Stories)

- 개발자로서, 조직의 “리뷰 봇” MCP 서버에 등록된 툴을 `crewx`로 탐색하고 실행하고 싶다.
- 운영팀으로서, 여러 프로젝트의 MCP 서버를 프로필로 등록하고 빠르게 전환하며 호출하고 싶다.
- 보안 담당자로서, 토큰/헤더가 로그에 노출되지 않고, 설정 파일/환경변수로 안전히 주입되길 원한다.

---

## 4. CLI 설계

- 명령군: `crewx mcp remote`
  - `crewx mcp remote servers [--json]`
    - 설명: 등록된 서버 프로필을 나열한다.
  - `crewx mcp remote list-tools [--server <id> | --endpoint <url>] [--key <token>] [--header 'K:V' ...] [--timeout <ms>] [--json]`
    - 설명: 지정 서버의 MCP 툴 목록을 조회한다.
  - `crewx mcp remote call-tool <toolName> [--server <id> | --endpoint <url>] [--params '<JSON>'] [--key <token>] [--header 'K:V' ...] [--timeout <ms>] [--raw]`
    - 설명: 지정 툴을 호출한다. `--params`는 JSON 오브젝트 문자열.

- 글로벌 옵션 재사용
  - `--log`(상세 로그), `--config`(에이전트 설정과 무관 — 충돌 없음)

- 출력 규칙
  - 기본: 사람 친화적 메시지 + 결과(JSON은 pretty-print)
  - `--json`/`--raw`: 결과 payload만 표준출력
  - 로그/진단은 표준에러로 출력 (`--log`일 때만 상세)

- 종료 코드
  - `0`: 성공
  - `1`: 사용성/검증 오류(인자/JSON 파싱/구성 부재 등)
  - `2`: 네트워크/인증 실패(HTTP 4xx/5xx, 타임아웃)
  - `3`: 원격 툴 오류(JSON-RPC error, 툴 레벨 실패)
  - `4`: 사용자 중단(SIGINT) 또는 기타 예외

---

## 5. 설정 파일(`mcp.json`) 설계

- 파일 경로 해석(우선순위)
  1. 환경변수 `CREWX_MCP_JSON`
  2. 프로젝트: `./.crewx/mcp.json`
  3. 사용자: `~/.config/crewx/mcp.json`

- 스키마(초안)
```json
{
  "$schema": "https://example.com/schemas/crewx.mcp.json",
  "version": "1",
  "servers": [
    {
      "id": "prod-backend",
      "baseUrl": "https://mcp.example.com:3000",
      "apiKey": "${CREWX_MCP_KEY}",
      "headers": { "User-Agent": "CrewX/1.0" },
      "timeoutMs": 300000,
      "default": true
    }
  ]
}
```

- 필드 정의
  - `version`: 스키마 버전(문자열)
  - `servers[].id`(필수): 고유 식별자
  - `servers[].baseUrl`(필수): MCP HTTP 엔드포인트 베이스 URL
  - `servers[].apiKey`(선택): Bearer 토큰(리터럴 또는 `${ENV}` 치환 지원)
  - `servers[].headers`(선택): 추가 헤더 맵(민감값 ENV 치환 허용)
  - `servers[].timeoutMs`(선택): 요청 타임아웃(ms), 기본 15000
  - `servers[].default`(선택): 기본 선택 여부(단일 또는 마지막 true 우선)

- 보안/ENV
  - `${ENV}` 토큰을 환경변수로 치환하여 비밀값을 코드/파일에 직접 저장하지 않도록 한다.
  - 로그에 토큰/민감 헤더값은 마스킹 처리한다.

---

## 6. 동작 규칙

- 서버 선택 규칙
  - `--server <id>`가 있으면 해당 프로필 사용
  - 없다면 `default:true` 프로필 사용
  - 둘 다 없으면 `--endpoint <url>`이 필수

- 인증/헤더 합성
  - 우선순위: CLI 인자(`--key`, `--header`) > 프로필 설정 > 없음
  - Authorization: `Bearer <token>` 규칙 사용(커스텀 헤더도 병행 가능)

- 요청/응답
  - JSON-RPC 메서드:
    - 목록: `tools/list`
    - 호출: `tools/call` with `{ name, arguments }`
  - 타임아웃: `timeoutMs` 적용, 초과 시 종료 코드 `2`
  - 결과 출력은 서버 응답 그대로 전달(가공 최소화)

---

## 7. 호환 및 재사용

- 내부 재사용: `src/services/mcp-client.service.ts` (HTTP JSON-RPC 클라이언트)
- 기존 명령과의 관계:
  - 유지: `crewx mcp call_tool`, `crewx mcp list_tools` (내부 등록 툴)
  - 추가: `crewx mcp remote ...` (외부 서버 대상)
- 툴 명명 규칙: CrewX 제공 툴은 `crewx_` 접두사 권장(예: `crewx_listAgents`)

---

## 8. 예시

- 서버 나열
```bash
crewx mcp remote servers --json
```

- 툴 목록
```bash
crewx mcp remote list-tools --server prod-backend
crewx mcp remote list-tools --endpoint http://127.0.0.1:9001 --key "$CREWX_MCP_KEY"
```

- 툴 호출
```bash
crewx mcp remote call-tool crewx_listAgents --server prod-backend
crewx mcp remote call-tool crewx_queryAgent \
  --endpoint http://localhost:9001 --key "$CREWX_MCP_KEY" \
  --params '{"agentId":"frontend","query":"lint rules"}' --raw
```

---

## 9. 오류 처리 및 메시지 가이드

- 검증 오류(코드 1): 누락 인자, 잘못된 JSON(`--params`는 객체여야 함)
- 연결 오류(코드 2): DNS/연결 실패, 인증 실패(401/403), 서버오류(5xx), 타임아웃
- 툴 오류(코드 3): JSON-RPC `error` 필드 포함 시 원문 전달 + 요약
- 로깅: 기본 최소, `--log` 시 메서드/URL/지연시간을 stderr로. 비밀값 마스킹

---

## 10. 보안 고려사항

- 인증 토큰/민감 헤더는 절대 평문 로그에 출력하지 않음
- 설정 파일 권한 가이드: 프로젝트 로컬은 팀 공유, 사용자 전역(`~/.config/crewx/mcp.json`)은 사용자 전용 권한 권장
- 향후 mTLS, IP 허용목록, 재시도/백오프 정책은 단계적 도입

---

## 11. 확장/로드맵

- Phase 1 (MVP / STDIO 우선)
  - STDIO 트랜스포트 도입(`kind=stdio`): 프로세스 스폰, init/initialized, shutdown/exit
  - `mcp.json` 확장: `command/args/cwd/env`, `initTimeoutMs`, `idleExitMs`, `restart` 정책
  - `servers`/`list-tools`/`call-tool` STDIO 경로 우선 지원, 기본 오류/종료코드 규약 적용
- Phase 2 (HTTP 보강)
  - HTTP+Bearer 지원, Keep-Alive, `tools/list` 캐시(TTL)
  - 헤더 다중 지정(`--header K:V` 반복), 프로필 유효성 검사
- Phase 3 (데몬/프리워밍)
  - `daemon start/stop/status`, `prewarm` 서브커맨드, 세션/캐시 고도화
- Phase 4 (통합/자동화)
  - Slack에서 원격 툴 호출 트리거(명시적), 결과 임베딩, 병렬/배치, 재시도 정책
- Phase 5 (고급 기능)
  - 스트리밍 이벤트, 원격 툴 자동 추천, STDIO 터널링(선택)
- Phase 6 (내부 통합)
  - 내부 provider 자동 call_tool 통합(스펙 정착 후 점진 활성화)

---

## 12. 오픈 이슈

- 툴 인자 스키마 자동 검증(원격 서버가 제공하는 스키마 활용 여부)
- 결과 크기/바이너리 응답 처리 정책(현재는 텍스트/JSON 전제)
- 다중 인증 스킴 지원(API Key 쿼리, HMAC 등)
- 프로필 암호화/비밀관리 연계(예: OS 키체인/HashiCorp Vault)

---

## 13. 유지보수

- 문서 갱신 시: `CREWX.md` Key Technologies의 “Protocols/Remote providers” 문구와 사용 예 업데이트 고려
- 실제 구현 후: README에 짧은 사용예 2~3줄 추가, `docs/remote-agents.md`에 교차 링크 삽입

**상태**: 초안(Draft) — 논의/피드백 환영

---

## 14. 세션/프로세스 관리 (초안)

목표: 매 호출마다 초기화(init) 핸드셰이크를 반복하지 않고, 서버/프로세스 세션을 재사용한다.

### 14.1 서버 종류(kind) 확장

- `kind`: `http` | `stdio` (기본값 `http`)
- `http`:
  - 연결 초기화 없음(단건 HTTP JSON-RPC)
  - HTTP Keep-Alive 에이전트 사용으로 커넥션 재사용
  - 툴 목록 캐시 TTL 지원(예: 60초)
- `stdio`:
  - 로컬 프로세스를 스폰하여 표준입출력(STDIO)로 MCP 수행
  - 최초 1회: `initialize` → `initialized` 핸드셰이크, 세션 유지
  - 유휴 종료(Idle timeout)와 재시작 정책 관리

### 14.2 `mcp.json` 스키마 보강(추가 필드)

```json
{
  "servers": [
    {
      "id": "local-copilot",
      "kind": "stdio",
      "command": "gh",
      "args": ["copilot", "mcp", "serve"],
      "cwd": "/path/to/project",
      "env": { "EXAMPLE": "${ENV_EXAMPLE}" },
      "initTimeoutMs": 10000,
      "idleExitMs": 300000,
      "restart": { "policy": "on-failure", "maxRestarts": 3, "backoffMs": 2000 }
    },
    {
      "id": "prod-backend",
      "kind": "http",
      "baseUrl": "https://mcp.example.com:3000",
      "apiKey": "${CREWX_MCP_KEY}",
      "keepAlive": true,
      "toolsCacheTtlMs": 60000
    }
  ]
}
```

- `stdio` 전용:
  - `command`, `args`, `cwd`, `env`: 프로세스 실행 정보(ENV 치환 지원)
  - `initTimeoutMs`: 초기화 핸드셰이크 타임아웃
  - `idleExitMs`: 유휴 시간 초과 시 종료(자원 회수)
  - `restart.policy`: `never` | `on-failure` | `always`
  - `restart.maxRestarts`, `restart.backoffMs`: 재시작 제어
- `http` 전용:
  - `keepAlive`: HTTP Keep-Alive 사용 여부
  - `toolsCacheTtlMs`: `tools/list` 응답 캐시 TTL

### 14.3 CLI: 데몬/세션 제어(옵션)

- `crewx mcp remote daemon start [--server <id>]`
  - 지정 서버 세션(HTTP/STDIO)을 프리워밍. STDIO는 프로세스 스폰+init 수행
- `crewx mcp remote daemon stop [--server <id>|--all]`
- `crewx mcp remote daemon status`
- `crewx mcp remote prewarm --server <id>`
  - 툴 목록 선조회 및 세션 활성화(캐시/세션 준비)

초기 도입은 선택사항이며, MVP에서는 개별 호출 시 내부 캐시/세션 재사용(단일 프로세스 수명)만으로 시작할 수 있다. 데몬은 Phase 2~3에서 도입 권장.

### 14.4 세션/캐시 전략

- HTTP: 요청 단위 연결이지만, Keep-Alive와 `tools/list` 캐시로 오버헤드 최소화
- STDIO: 프로세스 1개당 N회 호출 재사용; `shutdown`/`exit` 프로토콜 준수
- 오류 복구: 프로세스 크래시 시 백오프 재시작, 401/403 시 토큰 재주입 가이드

---

## 15. crewx-tools: STDIO MCP 서버 번들 가이드 (신규)

목표: 자주 쓰는 유틸리티/분석/리팩터 도구를 "crewx-tools"로 묶어 STDIO MCP 서버로 배포하고, `crewx mcp remote`로 바로 호출할 수 있게 한다.

### 15.1 패키징 권장사항

- 배포 형태: npm 패키지(예: `@crewx/crewx-tools`) with `bin` 엔트리(`crewx-tools`)
- 실행 방식: STDIO MCP 서버(단일 프로세스), JSON-RPC + LSP 프레이밍(Content-Length)
- 초기화: `initialize` → `initialized` 응답 후 `tools/list` 가능
- 종료: `shutdown` → `exit` 준수
- 로깅: 표준에러(stderr) 사용, 표준출력(stdout)은 프로토콜 전용

### 15.2 툴 명명/스키마

- 서버명: 자유(예: `crewxtools`), 툴 접두사 권장: `crewx_tools_`
- 각 툴은 다음 정보를 제공:
  - `name`(예: `crewx_tools_format`), `description`
  - `input_schema`/`output_schema`(JSON Schema Draft 7 권장)
- 예시 툴들:
  - `crewx_tools_listAgents`(CrewX 에이전트 조회 프록시)
  - `crewx_tools_format`(코드 포맷터), `crewx_tools_lint`, `crewx_tools_test`
  - `crewx_tools_refactor`(AST 기반 리팩터), `crewx_tools_search`(rg/grep 래핑)

### 15.3 mcp.json 등록 예시(STDIO)

```json
{
  "servers": [
    {
      "id": "crewx-tools",
      "kind": "stdio",
      "command": "crewx-tools",
      "args": ["serve"],
      "cwd": "${PWD}",
      "env": { "CREWX_ENV": "dev" },
      "initTimeoutMs": 10000,
      "idleExitMs": 300000,
      "restart": { "policy": "on-failure", "maxRestarts": 3, "backoffMs": 2000 }
    }
  ]
}
```

### 15.4 CLI 사용 예

```bash
# 툴 목록
crewx mcp remote list-tools --server crewx-tools

# 코드 포맷 실행
crewx mcp remote call-tool crewx_tools_format \
  --server crewx-tools \
  --params '{"paths":["src/**/*.ts"],"style":"project"}'
```

### 15.5 개발 가이드(요약)

- 프레이밍: `Content-Length: <n>\r\n\r\n<json>` 형식, 멀티청크 파싱
- 요청/응답 매칭: `id` 기반, 타임아웃/취소(Abort) 처리
- 견고성: 큰 payload, 연속 호출, 크래시 후 재시작 경로 테스트
- 보안: 외부 명령 실행 시 입력 검증/경로 정규화, 민감 로그 차단

---

## 16. CrewX 기본 MCP vs crewx-tools 툴 노출 분리 전략

CrewX CLI에는 내장 MCP 서버(`crewx` 이름, `crewx_` 접두사 툴)와 crewx-tools STDIO 서버가 공존한다. 두 서버의 책임·배포 주기·네임스페이스를 명확히 분리해 혼선을 방지한다.

### 16.1 역할 구분

| 구분 | CrewX 기본 MCP (`crewx`) | crewx-tools STDIO (`crewxtools` 권장) |
|------|-------------------------|--------------------------------------|
| 실행 위치 | `crewx` CLI 내부 NestJS 컨텍스트 (`src/crewx.tool.ts`) | 별도 프로세스(`crewx-tools serve`) |
| 주 기능 | 에이전트/원격 오케스트레이션, 상태/작업 관리 | 코드/파일 조작, 분석, 리팩터 등 실무 유틸 |
| 네임스페이스 | `crewx_` 접두사 고정 | `crewx_tools_` 접두사 권장 |
| 배포/버전 | CrewX CLI 릴리스와 동기화 | 독립 npm 패키지, SemVer 독립 관리 |
| 의존성 | CrewX 코어 서비스(AgentLoader, Task 등) 의존 | 선택 엔진(Prettier, ESLint 등)에 따라 모듈식 구성 |

### 16.2 CLI 노출 정책

- `crewx mcp list_tools` / `crewx mcp call_tool`  
  - 기본 MCP 서버 전용. CLI가 NestJS 컨텍스트에서 등록한 관리/오케스트레이션 툴만 대상.
- `crewx mcp remote ...`  
  - crewx-tools를 포함한 외부 MCP 서버 전용. `mcp.json` 프로필 기반으로 호출.
- CLI는 툴 목록 출력 시 서버 ID/네임스페이스를 함께 표시해 출처를 명확히 한다.

### 16.3 구성 관리 (mcp.json 예시)

```json
{
  "servers": [
    {
      "id": "crewx-tools",
      "kind": "stdio",
      "command": "crewx-tools",
      "args": ["serve"],
      "idleExitMs": 300000,
      "restart": { "policy": "on-failure", "maxRestarts": 5 }
    }
  ]
}
```

- 기본 MCP(`crewx`)는 CrewX CLI 내부에서 이미 관리하므로 `remote` 명령의 대상에 포함하지 않는다.
- 필요 시 `managed: true` 같은 메타 필드를 도입해 CLI 자동 스폰 대상과 수동 관리 대상을 구분할 수 있다(추후 결정).

### 16.4 네임스페이스/호출 규칙

- 기본 MCP와 crewx-tools는 툴 이름이 겹치지 않도록 한다.
- Slack/에이전트 통합 시에는 `serverId/toolName` 형태 명시(예: `crewxtools/crewx_tools_format`)를 가이드로 제공한다.
- CLI alias는 후속 단계에서 도입 가능하지만, 기본적으로 서버 구분을 명문화한다.

### 16.5 버전/배포 연계

- CrewX CLI 릴리스 노트에는 기본 MCP 변경만 포함, crewx-tools는 별도 체인지로그 유지.
- crewx-tools는 엔진 의존성을 peerDependencies 또는 optionalDependencies로 선언하여 설치 시점 확인.
- 입력/출력 스키마는 두 서버 모두 JSON Schema 기반을 따르고, MCP 브리지는 스키마 검증을 공통 처리한다.

### 16.6 향후 통합 가능성

- CrewX CLI가 crewx-tools 존재를 감지하면 선택적 alias 명령 제공 가능 (`crewx tool fmt` → `remote call-tool crewx_tools_format`).
- crewx-tools의 일부 툴을 기본 MCP의 고수준 오케스트레이션에서 호출하도록 연결할 수 있으나, 호출 경로는 명시적으로 유지한다.
