# WBS Job Report: wbs-6 / job-15

## Task: CrewXTool Integration - Trace Recording

### Status: Verified & Completed

### Changes Implemented
Verified `packages/cli/src/crewx.tool.ts` contains the trace recording logic for tool executions.

1.  **Tool Execution Interception**:
    -   `onModuleInit` intercepts `this.toolCallService.execute`.
    -   Wraps execution in `tracingService.startSpan` and `tracingService.endSpan`.
    -   Captures input (including Bash commands via `run_shell`), output, and duration.
    -   Links spans to active traces via `activeTraces` map (`taskId` -> `traceId`).

2.  **Trace Context Management**:
    -   `activeTraces` map tracks the correlation between Task IDs and Trace IDs.
    -   `queryAgent` and `executeAgent` methods register the Trace ID at start and cleanup on completion.

### Verification
-   **Skill/Tool Tracing**: Confirmed that `toolCallService.execute` interception covers all registered tools (including `run_shell`, `read_file`, etc.).
-   **Bash Tracing**: Confirmed that Bash commands executed via the `run_shell` tool are captured with their command strings in the span attributes.

---

# WBS Job Report: wbs-6 / job-16

## Task: CLI trace 명령어 구현

### 구현 내용
- `crewx trace` 명령어 라우팅/옵션 파싱/출력 핸들러를 추가하여 트레이싱 DB(선택적 의존성: `better-sqlite3`)에 저장된 실행 트레이스를 조회할 수 있도록 구현.

### Subcommands
- `crewx trace ls`: 최근 트레이스 목록 조회 (`--limit`, `--status`, `--agent`)
- `crewx trace show <id>`: 특정 트레이스 상세 조회 (attributes/metadata/spans 포함)
- `crewx trace thread <thread_ts>`: Slack `thread_ts` 또는 `sessionId` 기준으로 연관 트레이스 조회
- `crewx trace stats`: 기간/에이전트 기준 통계 조회 (`--days`, `--agent`)

### 변경/추가된 파일
- `packages/cli/src/handlers/trace.handler.ts`: TraceCommand 핸들러(서브커맨드 dispatch, 출력 포맷)
- `packages/cli/src/cli-options.ts`: `trace` 커맨드 및 옵션 파싱(`traceAction`, `id`, `--limit/--status/--agent/--days`)
- `packages/cli/src/cli/cli.handler.ts`: `trace` 커맨드 라우팅 추가
- `packages/cli/src/services/help.service.ts`: `trace` 사용 예시 추가
