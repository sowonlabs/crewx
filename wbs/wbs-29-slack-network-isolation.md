# WBS-29: Slack Bot Network Isolation 문제

**목표**: Slack Bot에서 실행되는 Codex Provider의 네트워크 접근 제한 해결

**현재 상태**: 문제 분석 완료, 해결 방안 도출 필요

---

## 문제 상황

### 증상

- **CLI 모드**: Codex provider가 정상 작동 (Notion API 접근 가능)
- **Slack Bot 모드**: Codex provider가 네트워크 차단 (DNS lookup 실패, fetch 실패)

### 원인 분석

```
CLI 모드 (정상):
사용자 터미널 (full network)
  ↓
crewx CLI (full network)
  ↓
codex CLI spawned (full network 상속)
  ↓
Notion API ✅

Slack Bot 모드 (차단):
Slack Bot Daemon (network restricted?)
  ↓
crewx CLI (restrictions inherited)
  ↓
codex CLI spawned (restrictions inherited)
  ↓
Notion API ❌ (DNS/fetch blocked)
```

### 근본 원인

- Slack Bot이 데몬으로 실행되면서 네트워크 제한이 자식 프로세스(Codex)에 상속됨
- Codex Provider는 stdin 대신 argument로 prompt를 전달하는 특수 구조 (`shouldPipeContext(): false`)
- 자체 sandbox 환경에서 실행되므로 환경 격리가 더 심함

---

## 가능한 원인

### 1. 프로세스 권한 상속
- Slack Bot의 제한된 권한이 spawn된 Codex에 상속
- Network capabilities 제한

### 2. 환경 변수 누락
- HTTP_PROXY / HTTPS_PROXY
- Codex credentials
- Network configuration

### 3. 시스템 네트워크 정책
- macOS App Sandbox 제한
- Docker/Container 네트워크 정책
- systemd/launchd 서비스 제한

---

## 검증 방법

```bash
# Slack Bot이 실행 중인 환경에서:

# 1. Bot 프로세스에서 네트워크 테스트
ps aux | grep slack  # Bot PID 확인
sudo -u <bot_user> curl -v https://www.notion.so

# 2. Codex를 Bot 사용자로 직접 실행
sudo -u <bot_user> codex "test network access"
```

---

## 해결 방안

### 옵션 1: 환경 변수 명시적 전달 (권장)

**구현 위치**: `packages/sdk/src/core/providers/base-ai.provider.ts`

**장점**:
- 안전, 최소 변경
- 다른 provider에 영향 없음

**단점**:
- Codex 전용 로직 필요

### 옵션 2: Bot 실행 환경 수정

**방법**:
- Docker: `--network=host`
- systemd: `RestrictAddressFamilies=AF_INET AF_INET6`
- macOS launchd: NetworkInbound/Outbound 허용

**장점**:
- Codex뿐 아니라 모든 자식 프로세스 해결

**단점**:
- 보안 정책 완화 필요

### 옵션 3: Codex sandbox 모드 조정

**구현 위치**: `packages/sdk/src/core/providers/codex.provider.ts`

**장점**:
- Codex 전용 해결
- 명확한 책임 분리

**단점**:
- Codex CLI가 옵션 지원 필요

---

## 작업 단계

### Phase 1: 환경 조사 (⬜️ 대기)

- [ ] Slack Bot 실행 환경 확인 (Docker? systemd? macOS service?)
- [ ] Bot 프로세스의 network capability 확인
- [ ] Codex CLI가 요구하는 네트워크 권한 확인
- [ ] 환경 변수 상속 패턴 분석

### Phase 2: 해결 방안 선택 (⬜️ 대기)

- [ ] 3가지 옵션 중 선택 (옵션 1 권장)
- [ ] 보안 영향 검토
- [ ] 구현 복잡도 평가

### Phase 3: 구현 (⬜️ 대기)

- [ ] 선택된 방안 구현
- [ ] Codex provider spawn 로직 수정
- [ ] 환경 변수 전달 추가

### Phase 4: 테스트 (⬜️ 대기)

- [ ] CLI 모드 정상 작동 확인 (regression test)
- [ ] Slack Bot 모드 네트워크 접근 확인
- [ ] 다른 provider (claude, gemini) 영향 없음 확인

### Phase 5: 문서화 (⬜️ 대기)

- [ ] Slack Bot 배포 가이드 업데이트
- [ ] 네트워크 요구사항 문서화
- [ ] 트러블슈팅 가이드 추가

---

## 관련 파일

- `packages/sdk/src/core/providers/base-ai.provider.ts` - spawn 로직
- `packages/sdk/src/core/providers/codex.provider.ts` - Codex 전용 설정
- `packages/cli/src/slack/slack-bot.service.ts` - Slack Bot 실행
