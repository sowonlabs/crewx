# Claude Code Docker 실행 가이드

## 개요
Claude Code를 Docker 컨테이너에서 실행하여 격리된 개발 환경을 구축하는 방법

## 커뮤니티 프로젝트
이미 여러 개발자들이 Docker 통합을 시도했습니다:

| 프로젝트 | 특징 | GitHub |
|---------|------|--------|
| claude-docker | 풀 권한 + Twilio 알림 | VishalJ99/claude-docker |
| claude-code-container | --dangerously-skip-permissions 모드 | tintinweb/claude-code-container |
| claude-code-sandbox | 안전한 로컬 실행 | textcortex/claude-code-sandbox |
| claudebox | macOS Keychain 통합 | koogle/claudebox |
| claude-container | 호스트 격리 + 영속 인증 | nezhar/claude-container |
| claude-code-yolo | 컨테이너 격리 권한 관리 | thevibeworks/claude-code-yolo |

## 인증 구조

### ⚠️ 중요: Claude 실행 방식별 차이

**VSCode Extension** (현재 사용 중):
- 경로: `~/.vscode/extensions/anthropic.claude-code-*/`
- 설정: `~/.claude.json` (계정 정보, MCP 서버 설정)
- 작업: `~/.claude/` (projects, todos, debug)
- 인증: VSCode 내부 관리 (토큰 파일 없음)

**Claude Desktop App**:
- 독립 GUI 애플리케이션
- 설정: `~/.claude.json`
- 인증: 앱 내부 관리

**Claude Code CLI** (커뮤니티 보고 기준):
- 인증: `~/.claude/.credentials.json` (OAuth 토큰)
- 구조:
```json
{
  "accessToken": "sk-ant-oat01-...",   // 단기 액세스 토큰
  "refreshToken": "sk-ant-ort01-...",  // 리프레시 토큰
  "expiresAt": 1234567890,            // 만료 시간
  "scopes": ["user:inference", "user:profile"]
}
```

### 실제 디렉토리 구조 (Claude Desktop)
```
~/
├── .claude.json           # Claude Desktop 설정
└── .claude/
    ├── projects/          # 프로젝트 히스토리
    ├── todos/            # 작업 관리
    ├── shell-snapshots/  # 쉘 스냅샷
    ├── debug/            # 디버그 로그
    ├── ide/              # IDE 통합 설정
    └── statsig/          # 분석 및 기능 플래그
```

**참고**: Claude Desktop은 `.credentials.json` 파일을 사용하지 않을 수 있음

## Docker 설정

### 1. Dockerfile
```dockerfile
FROM node:20-slim

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI 설치
RUN npm install -g @anthropic-ai/claude-code

# 비-root 사용자 생성
RUN useradd -m -s /bin/bash claude
USER claude
WORKDIR /home/claude

# 기본 명령
CMD ["claude"]
```

### 2. Docker Compose
```yaml
version: '3.8'

services:
  claude-code:
    build: .
    image: claude-code:latest
    container_name: claude-code-dev

    volumes:
      # 인증 디렉토리 (필수)
      - ~/.claude:/home/claude/.claude

      # 프로젝트 디렉토리
      - ./:/workspace

      # Git 설정 (읽기 전용)
      - ~/.gitconfig:/home/claude/.gitconfig:ro
      - ~/.ssh:/home/claude/.ssh:ro

      # MCP 서버 설정 (있는 경우)
      - ~/.config/claude-desktop:/home/claude/.config/claude-desktop:ro

    environment:
      # 추가 환경 변수 (선택)
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - NODE_ENV=development

    working_dir: /workspace
    stdin_open: true
    tty: true

    # 네트워크 설정 (MCP 서버 연결용)
    network_mode: host
```

## 실행 방법

### 사전 준비
```bash
# 1. Claude CLI 설치 확인
which claude
claude --version

# 2. 호스트에서 먼저 인증
claude login
# 브라우저가 열리고 로그인 완료 후 인증 저장

# 3. 인증 파일 위치 확인 (CLI 버전에 따라 다를 수 있음)
# 가능한 위치들:
# - ~/.claude/.credentials.json
# - ~/.config/claude-code/credentials.json
# - 환경변수 CLAUDE_CODE_OAUTH_TOKEN
```

### Docker 실행
```bash
# 이미지 빌드
docker build -t claude-code .

# 단독 실행
docker run -it \
  -v ~/.claude:/home/claude/.claude \
  -v $(pwd):/workspace \
  --name claude-code \
  claude-code

# Docker Compose 사용
docker-compose up -d
docker-compose exec claude-code claude
```

### 백그라운드 실행
```bash
# 데몬 모드 시작
docker-compose up -d

# 접속
docker exec -it claude-code-dev claude

# 종료
docker-compose down
```

## 보안 고려사항

### DO ✅
- 호스트에서 인증 후 볼륨 마운트
- 민감한 파일은 읽기 전용(`:ro`) 마운트
- 비-root 사용자(claude)로 실행
- `.aiexclude` 파일로 민감한 파일 보호
- 신뢰할 수 있는 프로젝트에서만 사용

### DON'T ❌
- 도커 이미지에 credentials 포함
- root 권한으로 실행
- `--dangerously-skip-permissions` 무분별 사용
- 공개 레지스트리에 인증 정보 포함된 이미지 푸시

## 문제 해결

### 인증 유지 문제
컨테이너 재시작 시 인증이 유지되지 않는 경우:
```bash
# 볼륨 마운트 확인
docker inspect claude-code-dev | grep Mounts -A 20

# 권한 확인
docker exec claude-code-dev ls -la /home/claude/.claude/
```

### 토큰 만료
```bash
# 호스트에서 재인증
claude logout
claude login

# 컨테이너 재시작
docker-compose restart
```

### MCP 서버 연결
MCP 서버(crewx 등) 연결이 필요한 경우:
```yaml
# docker-compose.yml에 추가
network_mode: host  # 또는 bridge with port mapping
```

## 활용 사례

### 1. 프로젝트별 격리
```bash
# 프로젝트 A
cd ~/projects/project-a
docker-compose up -d

# 프로젝트 B (다른 터미널)
cd ~/projects/project-b
docker-compose up -d
```

### 2. CI/CD 통합
```yaml
# .gitlab-ci.yml 예시
claude-review:
  image: claude-code:latest
  script:
    - claude review --project /workspace
  volumes:
    - ~/.claude:/home/claude/.claude:ro
```

### 3. 팀 환경 공유
```bash
# 팀 공통 이미지
docker build -t company/claude-code:v1 .
docker push company/claude-code:v1

# 팀원 사용
docker pull company/claude-code:v1
docker run -it -v ~/.claude:/home/claude/.claude company/claude-code:v1
```

## 장점
- **환경 격리**: 프로젝트별 독립된 환경
- **버전 관리**: 특정 Claude Code 버전 고정
- **팀 협업**: 동일한 개발 환경 공유
- **자동화**: CI/CD 파이프라인 통합
- **보안**: 호스트 시스템 보호

## 한계
- 토큰 만료 시 재인증 필요
- GUI 애플리케이션 실행 제한
- 일부 네이티브 기능 제한 가능
- 컨테이너 오버헤드

## 참고 자료
- [Anthropic Claude Code 공식 문서](https://docs.claude.com/en/docs/claude-code)
- [Docker MCP 통합 가이드](https://www.docker.com/blog/the-model-context-protocol)
- [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)