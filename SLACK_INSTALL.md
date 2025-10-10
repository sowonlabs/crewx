# Slack App 설치 가이드

CrewX Slack Bot을 설치하기 위한 단계별 가이드입니다.

## 📋 개요

Slack App을 생성하고 3개의 토큰을 발급받아 CrewX Bot을 연동합니다.

**필요한 토큰:**
1. Bot User OAuth Token (xoxb-...)
2. App-Level Token (xapp-...)
3. Signing Secret

---

## 🚀 설치 단계

### Step 1: Slack App 생성

1. https://api.slack.com/apps 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택
4. App Name: `CrewX` 입력
5. 워크스페이스 선택
6. **"Create App"** 클릭

---

### Step 2: Bot Token Scopes 추가 ⚡

> **중요:** 이 단계를 먼저 해야 토큰을 발급받을 수 있습니다!

1. 왼쪽 사이드바에서 **"OAuth & Permissions"** 클릭
2. 아래로 스크롤해서 **"Scopes"** 섹션 찾기
3. **"Bot Token Scopes"** 아래 **"Add an OAuth Scope"** 클릭
4. 다음 권한들을 **하나씩** 추가:

   | Scope | 설명 |
   |-------|------|
   | `app_mentions:read` | 봇이 @멘션될 때 읽기 |
   | `chat:write` | 메시지 보내기 |
   | `channels:history` | 채널 메시지 읽기 (스레드 히스토리 포함) |
   | `channels:read` | 채널 정보 보기 |
   | `reactions:write` | 메시지에 반응(이모지) 추가 |
   | `reactions:read` | 메시지 반응 읽기 |
   | `im:history` | DM 메시지 히스토리 읽기 |
   | `groups:history` | 비공개 채널 히스토리 읽기 (선택사항) |

**✅ 7-8개 권한이 모두 추가되었는지 확인하세요!**

> **💡 Reaction 권한이 필요한 이유:**
> - 봇이 요청을 처리 중일 때 👀 (eyes) 이모지를 표시합니다
> - 처리 완료 시 ✅ (white_check_mark), 에러 시 ❌ (x) 이모지로 상태를 표시합니다
> - 채널 뷰에서도 봇의 처리 상태를 한눈에 확인할 수 있습니다

> **💡 History 권한이 필요한 이유:**
> - `channels:history`는 스레드 대화 히스토리를 가져오는 데 필수입니다
> - `im:history`는 DM에서 스레드 히스토리를 사용하려면 필요합니다

---

### Step 3: Socket Mode 활성화 🔌

1. 왼쪽 사이드바에서 **"Socket Mode"** 클릭
2. **"Enable Socket Mode"** 토글을 **ON**으로 변경
3. 팝업이 나타나면:
   - Token Name: `crewx-socket` 입력
   - **"Add Scope"** 클릭
   - `connections:write` 선택
   - **"Generate"** 클릭
4. 🔑 **App-Level Token이 표시됩니다 (xapp-로 시작)**
5. **⚠️ 이 토큰을 복사해서 안전한 곳에 저장하세요!** (다시 볼 수 없습니다)

```
예시: xapp-1-A01234567-1234567890123-abcdefghijklmnop
```

---

### Step 4: Event Subscriptions 설정 📡

1. 왼쪽 사이드바에서 **"Event Subscriptions"** 클릭
2. **"Enable Events"** 토글을 **ON**으로 변경
3. 아래로 스크롤해서 **"Subscribe to bot events"** 섹션 찾기
4. **"Add Bot User Event"** 클릭
5. 다음 이벤트들을 추가:

   | Event | 설명 |
   |-------|------|
   | `app_mention` | @crewx가 멘션될 때 |
   | `message.channels` | 채널에 메시지가 올라올 때 (선택사항) |

6. **"Save Changes"** 클릭

---

### Step 5: 워크스페이스에 설치 🏢

1. 왼쪽 사이드바에서 **"Install App"** 클릭
2. **"Install to Workspace"** 버튼 클릭
3. 권한 요청 화면에서 다음을 확인:
   - View messages and other content in public channels
   - View basic information about public channels
   - Send messages as @crewx
4. **"Allow"** 클릭
5. 🔑 **Bot User OAuth Token이 표시됩니다 (xoxb-로 시작)**
6. **⚠️ 이 토큰을 복사해서 저장하세요!**

```
예시: xoxb-XXXXXXXXXXXX-XXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX
```

---

### Step 6: Signing Secret 가져오기 🔐

1. 왼쪽 사이드바에서 **"Basic Information"** 클릭
2. **"App Credentials"** 섹션 찾기
3. **"Signing Secret"** 항목 찾기
4. **"Show"** 버튼 클릭
5. 🔑 **Signing Secret을 복사해서 저장하세요!**

```
예시: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 📝 환경 변수 설정

이제 3개의 토큰을 받았으니 `.env.slack` 파일을 생성합니다:

```bash
cd /path/to/crewx/worktree/slack-bot
cp .env.slack.example .env.slack
```

`.env.slack` 파일을 편집하고 토큰 값들을 입력:

```bash
# Slack Bot Token (Step 5에서 받은 값)
SLACK_BOT_TOKEN=xoxb-your-actual-bot-token-here

# Slack App Token (Step 3에서 받은 값)
SLACK_APP_TOKEN=xapp-your-actual-app-token-here

# Slack Signing Secret (Step 6에서 받은 값)
SLACK_SIGNING_SECRET=your-actual-signing-secret-here
```

---

## ✅ 설치 확인 체크리스트

모든 단계를 완료했는지 확인하세요:

- [ ] Slack App 생성 완료
- [ ] Bot Token Scopes 7-8개 추가 (`app_mentions:read`, `chat:write`, `channels:history`, `channels:read`, `reactions:write`, `reactions:read`, `im:history`, `groups:history`)
- [ ] Socket Mode 활성화 + App Token (xapp-...) 발급
- [ ] Event Subscriptions 설정 (`app_mention` 이벤트 구독)
- [ ] 워크스페이스에 앱 설치 + Bot Token (xoxb-...) 발급
- [ ] Signing Secret 확인
- [ ] `.env.slack` 파일 생성 및 3개 토큰 입력

---

## 🚀 Bot 실행

환경 변수가 설정되었으면 Bot을 실행할 수 있습니다:

```bash
# 빌드 (처음 한 번만)
npm run build

# Bot 실행 (기본: Claude)
source .env.slack && crewx slack

# 다른 에이전트 사용
source .env.slack && crewx slack --agent gemini
source .env.slack && crewx slack --agent copilot

# 또는 로그와 함께 실행
source .env.slack && crewx slack --log
source .env.slack && crewx slack --agent gemini --log
```

성공하면 다음과 같이 표시됩니다:

```
⚡️ CrewX Slack Bot is running!
📱 Socket Mode: Enabled
🤖 Using default agent for Slack: claude
```

---

## 🧪 테스트

Slack 워크스페이스에서 테스트해보세요:

1. 아무 채널에 CrewX 봇을 초대:
   ```
   /invite @crewx
   ```

2. 메시지 보내기:
   ```
   @crewx Hello! What can you help me with?
   ```

3. Bot이 응답하면 성공! 🎉

---

## ❓ 문제 해결

### Bot이 응답하지 않을 때

1. **Bot이 채널에 초대되었는지 확인**
   ```
   /invite @crewx
   ```

2. **토큰이 올바른지 확인**
   - xoxb-로 시작하는지
   - xapp-로 시작하는지
   - 복사할 때 공백이 없는지

3. **Socket Mode가 켜져 있는지 확인**
   - https://api.slack.com/apps
   - Your App → Socket Mode → Enabled 확인

4. **Event Subscriptions 확인**
   - `app_mention` 이벤트가 구독되어 있는지

### "Missing Scope" 오류

Bot Token Scopes가 부족합니다. Step 2로 돌아가서 필요한 권한을 모두 추가하세요:

**필수 권한:**
- `app_mentions:read`
- `chat:write`
- `channels:history`
- `channels:read`
- `reactions:write` ⬅️ **봇 상태 표시용 (👀, ✅, ❌)**
- `reactions:read` ⬅️ **반응 관리용**
- `im:history` ⬅️ **DM 스레드 히스토리용**
- `groups:history` ⬅️ **비공개 채널 히스토리용 (선택사항)**

**⚠️ 중요:** 권한을 추가한 후에는 반드시 **앱을 재설치**해야 합니다:
1. "OAuth & Permissions" 페이지에서 권한 추가
2. "Install App" 페이지로 이동
3. **"Reinstall to Workspace"** 버튼 클릭
4. 권한 요청 화면에서 새로운 권한 확인 후 **"Allow"** 클릭

### 스레드 대화 기억하지 못할 때

스레드 내에서 이전 대화를 기억하지 못하는 경우:
1. `channels:history`, `im:history` 권한이 추가되었는지 확인
2. 권한 추가 후 Bot을 재설치 (재설치 필요시 OAuth & Permissions에서 "Reinstall to Workspace" 클릭)

### 로그 확인

```bash
# 상세 로그 보기
source .env.slack && crewx slack --log-level debug
```

---

## 📚 다음 단계

- [Slack Bot 사용법](./README_SLACK_BOT.md)
- [고급 설정](./SLACK_BOT_SETUP.md)
- [에이전트 커스터마이징](./crewx.yaml)

---

## 🔒 보안 참고사항

- ⚠️ `.env.slack` 파일은 **절대 Git에 커밋하지 마세요**
- ⚠️ 토큰을 공개 저장소나 Slack 메시지에 노출하지 마세요
- ⚠️ 토큰이 유출되면 즉시 https://api.slack.com/apps 에서 재발급하세요

---

**설치 완료!** 🎉 이제 Slack에서 CrewX를 사용할 수 있습니다!
