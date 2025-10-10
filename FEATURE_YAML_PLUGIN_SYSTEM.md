# Feature Request: YAML 기반 CLI 프로바이더 플러그인 시스템

## Summary
YAML 설정 파일을 통해 외부 CLI 기반 AI 프로바이더를 동적으로 추가할 수 있는 플러그인 시스템을 구현한다.

## Background
- 현재 CrewX는 Claude, Gemini, Copilot 3개의 내장 프로바이더만 지원
- Aider, Cursor 등 다른 AI CLI 도구를 추가하려면 코드 수정 필요
- 사용자가 원하는 CLI 도구를 쉽게 통합할 수 있는 확장 메커니즘 필요

## Proposed Solution: YAML 기반 동적 프로바이더 로딩

### 구현 방식
사용자가 crewx.yaml에 프로바이더 설정을 추가하면 CrewX가 자동으로 로딩

### 설정 예시
```yaml
# ~/.crewx/crewx.yaml
providers:
  - id: aider
    type: plugin
    cli_command: aider
    query_args: ["--yes", "--no-auto-commits", "--message"]
    execute_args: ["--yes", "--auto-commits", "--message"]
    prompt_in_args: true
    timeout:
      query: 600000
      execute: 1200000

agents:
  - id: aider_dev
    provider: aider
    name: "Aider Developer"
    specialties:
      - "Git-aware coding"
```

### 사용 시나리오
```bash
# 1. Aider CLI 설치
pip install aider-chat

# 2. crewx.yaml 설정 추가

# 3. 즉시 사용 (코드 수정 불필요)
crewx query "@aider_dev refactor this function"
```

## Implementation Components

### 1. DynamicProviderFactory (신규)
- YAML 설정 → BaseAIProvider 인스턴스 생성
- 보안 검증 (CLI 명령어, 인자 sanitization)
- 파일: `src/providers/dynamic-provider.factory.ts`

### 2. AIProviderService 수정
- `loadPluginProviders()` 메서드 추가
- 런타임에 플러그인 프로바이더 로딩
- 파일: `src/ai-provider.service.ts`

### 3. AgentConfigService 수정
- `providers` 섹션 스키마 추가
- Zod 검증 강화
- 파일: `src/config/agent-config.service.ts`

## Security Measures (CRITICAL)

### 필수 보안 조치

#### 1. CLI 명령어 검증
**블랙리스트:**
- Unix shells: `bash`, `sh`, `zsh`, `fish`
- Windows shells: `cmd`, `powershell`, `pwsh`
- Interpreters: `python`, `python3`, `node`, `ruby`, `perl`
- File operations: `rm`, `del`, `rmdir`, `mv`, `cp`
- Permission changes: `chmod`, `chown`, `sudo`, `su`
- Network tools: `curl`, `wget`, `nc`, `netcat`

**검증 규칙:**
- 셸 메타문자 차단: `;`, `&`, `|`, `` ` ``, `$()`
- 경로 순회 방지: `..`, `/`, `\`
- 화이트스페이스 정규화

#### 2. CLI 인자 Sanitization
- 셸 메타문자 차단: `;`, `&`, `|`, `<`, `>`, `` ` ``, `$()`
- 명령 치환 패턴 차단: `$(...)`, `` `...` ``
- NULL 바이트 제거: `\0`

#### 3. 안전한 YAML 파싱
```typescript
yaml.load(yamlContent, {
  schema: yaml.FAILSAFE_SCHEMA,  // !!python, !!exec 차단
  json: true,
})
```

#### 4. 환경변수 제한
**허용 목록:**
- `PATH`
- `HOME`
- `USER`
- `LANG`
- `LC_ALL`
- `PYTHONIOENCODING`
- `TERM`

**차단:** API 키, 토큰, 비밀번호 등 민감 정보

#### 5. 타임아웃/ReDoS 방지
- Query 타임아웃 최대값: 30분 (1,800,000ms)
- Execute 타임아웃 최대값: 1시간 (3,600,000ms)
- 정규식 패턴 ReDoS 검증 (safe-regex 라이브러리)

## Benefits

### 사용자 측면
- ✅ 코드 작성 불필요 (YAML만 수정)
- ✅ 빠른 통합 (CLI 설치 + 설정 추가)
- ✅ 기존 agents.yaml 패턴과 일관성

### 개발자 측면
- ✅ 빠른 구현 (3-5일, 보안 강화 포함)
- ✅ 기존 BaseAIProvider 재사용
- ✅ 테스트 부담 적음

### 아키텍처 측면
- ✅ 확장 가능 (나중에 NPM 플러그인으로 업그레이드 가능)
- ✅ 단순성 유지 (CrewX는 CLI 래퍼 역할)

## Implementation Phases

### Phase 1: 코어 기능 (2일)
- [ ] DynamicProviderFactory 구현
- [ ] AIProviderService.loadPluginProviders() 구현
- [ ] AgentConfigService providers 스키마 추가
- [ ] 기본 테스트 작성

### Phase 2: 보안 강화 (1일)
- [ ] CLI 명령어 블랙리스트/검증
- [ ] CLI 인자 sanitization
- [ ] 안전한 YAML 파싱 (FAILSAFE_SCHEMA)
- [ ] 환경변수 제한
- [ ] 타임아웃/ReDoS 방어

### Phase 3: 통합 테스트 (1일)
- [ ] Aider 통합 테스트
- [ ] 보안 테스트 (악의적 YAML 차단)
- [ ] crewx doctor에 플러그인 프로바이더 표시

### Phase 4: 문서화 (1일)
- [ ] README 업데이트 (플러그인 추가 가이드)
- [ ] Aider, Cursor 예제 작성
- [ ] 보안 가이드라인 문서화

## Alternative Approaches (Rejected)

### 옵션 2: NPM 패키지 플러그인
- **난이도:** 높음 (7-10일)
- **보안 위험:** 높음 (공급망 공격)
- **사용자 부담:** npm install 필요
- **결론:** 초기 단계에 과도하게 복잡

### 옵션 3: JavaScript 플러그인 파일
- **난이도:** 중간 (4-5일)
- **보안 위험:** 매우 높음 (임의 코드 실행)
- **사용자 부담:** JS 작성 필요
- **결론:** 보안 위험 완화 불가능

## Security Risk Assessment

### 옵션 1 (YAML 기반) - 권장
- **임의 명령 실행:** 🟡 중간 → 🟢 낮음 (블랙리스트 적용 시)
- **YAML 인젝션:** 🟡 중간 → 🟢 낮음 (FAILSAFE_SCHEMA)
- **악성 코드 실행:** 🟢 낮음
- **프롬프트 인젝션:** 🟡 중간 (완화 가능)
- **환경변수 탈취:** 🟡 중간 → 🟢 낮음 (허용 목록)
- **파일시스템 접근:** 🟡 중간 (제한적)
- **전반적 위험도:** 🟡 중간 → **🟢 낮음 (보안 조치 후)**

### 옵션 2 (NPM 패키지)
- **전반적 위험도:** 🔴 높음 (공급망 공격, 완화 어려움)

### 옵션 3 (JS 파일)
- **전반적 위험도:** 🔴 높음 (임의 코드 실행, 완화 거의 불가능)

## References
- 상세 설계안: `PLUGIN_PROPOSAL.md`
- 보안 분석: `PLUGIN_SECURITY_ANALYSIS.md`
- Slack 논의 스레드: 2025-10-11

## Success Criteria
- [ ] 사용자가 YAML 설정만으로 Aider 프로바이더 추가 가능
- [ ] 악의적 YAML 설정 차단 (보안 테스트 통과)
- [ ] 기존 3개 내장 프로바이더 정상 동작 (회귀 테스트)
- [ ] 문서화 완료 (README + 예제)

## Estimated Effort
**총 5일**
- 코어 기능: 2일
- 보안 강화: 1일
- 통합 테스트: 1일
- 문서화: 1일

## Labels
- `type:feature`
- `priority:중간`
- `version:0.1.x`
- `target_release:0.1.x` (v0.1.3 또는 v0.1.4)
- `area:providers`
- `security:reviewed`

## Dependencies
- js-yaml (FAILSAFE_SCHEMA)
- safe-regex (ReDoS 방지)
- Zod (스키마 검증)

## Notes
- 이 기능은 CrewX의 확장성을 크게 향상시킴
- 보안 조치가 Critical - 반드시 모든 체크리스트 완료 필요
- 초기 버전(v0.1.3)에서는 YAML 방식만 구현
- NPM 플러그인 시스템은 v1.0 이후 검토
