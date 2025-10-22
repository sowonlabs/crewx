[← WBS 개요](../wbs.md)

# WBS-3: CLI 패키지 정리 작업 계획

## 목표
- `packages/cli`로 CLI, Slack, MCP 등 사용자 인터페이스 코드 분리
- MIT 라이선스 유지
- SDK를 워크스페이스 의존성으로 사용하여 비즈니스 로직 재사용

## 선행 조건
- [x] WBS-1: 워크스페이스 구조 설정 완료
- [x] `packages/cli` 디렉토리 생성
- [ ] WBS-2: SDK 패키지 기본 구조 (최소한 Phase 1 완료)

## Phase 1: CLI 패키지 초기 설정 (Day 1)

### 1.1 CLI package.json 생성
```json
{
  "name": "crewx",
  "version": "0.3.0",
  "license": "MIT",
  "description": "CLI for CrewX - Bring Your Own AI team",
  "bin": {
    "crewx": "dist/main.js"
  },
  "dependencies": {
    "@sowonai/crewx-sdk": "workspace:*",
    "@nestjs/platform-express": "^11.0.0",
    "@slack/bolt": "^4.4.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "yargs": "^17.7.0",
    "chalk": "^4.1.2"
  }
}
```

### 1.2 진입점 파일 이동
- [ ] `src/main.ts` → `packages/cli/src/main.ts`
- [ ] `src/app.module.ts` → `packages/cli/src/app.module.ts`
- [ ] `src/version.ts` → `packages/cli/src/version.ts`

### 1.3 Nest CLI 설정 조정
- [ ] `packages/cli/nest-cli.json` 생성
- [ ] 빌드 출력 경로를 `packages/cli/dist`로 설정
- [ ] 소스 루트를 `packages/cli/src`로 변경

### 1.4 초기 빌드 테스트
- [ ] `npm run build -w crewx` 성공 확인
- [ ] `packages/cli/dist/main.js` 생성 확인

## Phase 2: CLI 핸들러 이동 (Day 2)

### 2.1 디렉토리 구조 생성
```
packages/cli/src/
├── cli/               # 명령어 핸들러
├── guards/            # 보안 가드
└── utils/             # CLI 전용 유틸리티
```

### 2.2 CLI 핸들러 파일 이동
- [ ] `src/cli/query.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/execute.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/chat.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/agent.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/init.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/doctor.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/help.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/templates.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/mcp.handler.ts` → `packages/cli/src/cli/`
- [ ] `src/cli/cli.handler.ts` → `packages/cli/src/cli/`

### 2.3 CLI 관련 설정 이동
- [ ] `src/cli-options.ts` → `packages/cli/src/cli-options.ts`

### 2.4 CLI 유틸리티 이동
- [ ] `src/utils/stdin-utils.ts` → `packages/cli/src/utils/`
- [ ] `src/utils/mcp-installer.ts` → `packages/cli/src/utils/`
- [ ] `src/stderr.logger.ts` → `packages/cli/src/utils/`

## Phase 3: 플랫폼별 통합 이동 (Day 2-3)

### 3.1 Slack 통합
```
packages/cli/src/slack/
├── slack-bot.ts
├── formatters/
│   └── message.formatter.ts
└── providers/
    └── slack-conversation-history.provider.ts
```

### 3.2 Slack 파일 이동
- [ ] `src/slack/*` → `packages/cli/src/slack/`
- [ ] `src/conversation/slack-conversation-history.provider.ts` → `packages/cli/src/slack/providers/`

### 3.3 MCP 통합
```
packages/cli/src/mcp/
├── mcp.controller.ts
├── crewx.tool.ts
└── services/
```

### 3.4 MCP 파일 이동
- [ ] `src/mcp.controller.ts` → `packages/cli/src/mcp/`
- [ ] `src/crewx.tool.ts` → `packages/cli/src/mcp/`
- [ ] `src/health.controller.ts` → `packages/cli/src/mcp/`

## Phase 4: CLI 전용 서비스 정리 (Day 3-4)

### 4.1 CLI 전용 서비스 이동
- [ ] `src/services/mcp-client.service.ts` → `packages/cli/src/services/`
- [ ] `src/services/mcp-remote.service.ts` → `packages/cli/src/services/`
- [ ] `src/services/mcp-remote-config.service.ts` → `packages/cli/src/services/`
- [ ] `src/services/help.service.ts` → `packages/cli/src/services/`
- [ ] `src/services/result-formatter.service.ts` → `packages/cli/src/services/`

### 4.2 CLI Conversation Provider
- [ ] `src/conversation/cli-conversation-history.provider.ts` → `packages/cli/src/conversation/`
- [ ] `src/conversation/conversation-provider.factory.ts` → `packages/cli/src/conversation/`

### 4.3 인증 및 보안
- [ ] `src/guards/bearer-auth.guard.ts` → `packages/cli/src/guards/`
- [ ] `src/services/auth.service.ts` → `packages/cli/src/services/`
- [ ] `src/utils/simple-security.ts` → `packages/cli/src/utils/`

### 4.4 프로젝트 관련 서비스
- [ ] `src/project.service.ts` → `packages/cli/src/services/`

## Phase 5: Import 경로 수정 및 통합 (Day 4-5)

### 5.1 SDK Import 전환
```typescript
// Before
import { AIService } from '../services/ai.service';
import { BaseAIProvider } from '../providers/base-ai.provider';

// After
import { AIService, BaseAIProvider } from '@sowonai/crewx-sdk';
```

### 5.2 상대 경로 정리
- [ ] 모든 파일에서 SDK 관련 import를 `@sowonai/crewx-sdk`로 변경
- [ ] CLI 내부 import는 상대 경로 유지
- [ ] 순환 의존성 확인 및 해결

### 5.3 Tool 서비스 특별 처리
- [ ] `tool-call.service.ts` 분석
- [ ] MCP 구현부는 CLI에 유지
- [ ] 인터페이스는 SDK에서 import

### 5.4 최종 통합 테스트
- [ ] 모든 CLI 명령어 동작 확인
- [ ] Slack 봇 실행 테스트
- [ ] MCP 서버 모드 테스트

## 체크포인트 및 검증

### 일일 검증 항목
- [ ] Day 1: CLI 패키지 독립 빌드
- [ ] Day 2: 핸들러 실행 테스트
- [ ] Day 3: Slack/MCP 통합 테스트
- [ ] Day 4: SDK 의존성 확인
- [ ] Day 5: 전체 기능 테스트

### 리스크 관리
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| crewx.tool.ts 분리 | 높음 | 점진적 리팩토링 |
| SDK 의존성 누락 | 중간 | WBS-2와 긴밀한 협업 |
| 경로 혼란 | 중간 | 체계적인 import 관리 |
| 기능 손상 | 높음 | 각 단계별 테스트 |

## 성공 지표
- [ ] CLI 독립 빌드 성공
- [ ] 모든 명령어 정상 동작
- [ ] `npm install -g crewx` 동작
- [ ] SDK만 import (순환 의존성 없음)
- [ ] 기존 사용자 경험 100% 유지

## 산출물
- `packages/cli/dist/main.js` - 실행 가능한 CLI
- 업데이트된 CLI 문서
- 테스트 결과 보고서

## WBS-2와의 협업 포인트
- **Day 1**: SDK export 규칙 합의
- **Day 2**: Provider 인터페이스 확정
- **Day 3**: Tool 서비스 분리 전략
- **Day 4**: 통합 테스트 계획
- **Day 5**: 최종 통합 및 검증

## 다음 단계
- WBS-4: 테스트 재구성
- WBS-5: 빌드 및 배포 파이프라인
