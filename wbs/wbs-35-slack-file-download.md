# WBS-35: Slack File Download (슬랙 파일 다운로드)

## 문서 정보
- **작성일**: 2025-11-20
- **WBS 번호**: 35
- **우선순위**: P1 (High Priority - UX Enhancement)
- **상태**: Design Review Completed
- **관련 이슈**: 없음
- **대상 버전**: 0.8.x

## 📋 개발자 리뷰 완료

**리뷰 일시**: 2025-11-20
**참여**: @crewx_claude_dev, @crewx_codex_dev

### 종합 평가

| 항목 | 상태 | 평가 |
|------|------|------|
| 구현 가능성 | 🟢 GREEN | 100% 구현 가능 |
| 아키텍처 | 🟡 YELLOW | 일부 수정 필요 |
| 보안/성능 | 🟡 YELLOW | 마이너 갭 있음 |
| 시간 예측 | 🟢 GREEN | 14-20h 현실적 |
| **최종 권장** | ✅ **APPROVED** | Option A - Ship local downloader |

### 주요 발견 사항

#### 🔴 Critical Issue
- **WBS 문서 오류**: `slack-handler.service.ts` 파일 존재하지 않음
- **실제 통합 지점**: `packages/cli/src/slack/slack-bot.ts:290-520` (handleCommand 메서드)

#### 🟡 개선 권장사항
1. **파일 사이즈 기본값**: 10MB 사용 (문서의 50MB → 10MB 수정)
2. **Rate Limiting**: Slack API 429 응답 처리 추가
3. **메타데이터 저장**: DB 또는 JSON 기반 영속화 필요

#### ✅ 긍정적 평가
- Slack API 통합 방식 완벽함
- Path injection 방지 로직 훌륭함
- 파일 구조 (.crewx/slack-files/{thread_id}/) 적절함

### 상세 리뷰 스레드
- Claude Dev 기술 검토: `wbs-35-review-claude`
- Codex Dev 코드 검토: `wbs-35-review-codex`
- Template Context 검증: `wbs-35-template-context`

## 개요

슬랙에서 사용자가 파일을 업로드하면 자동으로 다운로드하여 특정 디렉토리에 저장하고, AI 에이전트가 해당 파일을 자동으로 인식하여 활용할 수 있도록 하는 기능입니다.

## 핵심 요구사항

### 기본 동작
1. 사용자가 슬랙 스레드에 파일 업로드
2. 슬랙 봇이 파일을 감지하고 자동 다운로드
3. 설정된 디렉토리에 파일 저장 (예: `.crewx/slack-files/`)
4. AI 에이전트가 파일 경로를 받아서 처리 가능
5. 파일 메타데이터 추적 (업로더, 타임스탬프, 스레드 ID 등)

### 사용 시나리오

```
User: [파일 업로드: requirements.pdf]
User: @CrewX 이 요구사항 문서를 분석해줘

Bot: 📎 파일 다운로드 완료: requirements.pdf (245KB)
Bot: [Claude AI 분석 시작]
      요구사항 문서를 분석했습니다...
```

## 기술 아키텍처

### 1. 파일 다운로드 서비스

**위치**: `packages/cli/src/slack/services/slack-file-download.service.ts`

```typescript
export interface SlackFileMetadata {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  threadId: string;
  channelId: string;
  downloadedAt: Date;
}

export class SlackFileDownloadService {
  private readonly logger = new Logger(SlackFileDownloadService.name);
  private readonly downloadDir: string;

  constructor(private readonly configService: ConfigService) {
    // Default: .crewx/slack-files/
    this.downloadDir = this.configService.getSlackFileDownloadDir();
  }

  /**
   * 슬랙 파일을 다운로드하여 로컬에 저장
   */
  async downloadFile(
    client: WebClient,
    fileId: string,
    fileName: string,
    threadId: string,
    channelId: string,
    userId: string
  ): Promise<SlackFileMetadata> {
    // 1. Slack API로 파일 정보 조회
    const fileInfo = await client.files.info({ file: fileId });

    // 2. 파일 다운로드 (private URL 사용)
    const fileBuffer = await this.fetchFileFromSlack(
      fileInfo.file.url_private,
      client
    );

    // 3. 로컬 디렉토리에 저장
    const savePath = path.join(
      this.downloadDir,
      threadId,
      this.sanitizeFileName(fileName)
    );

    await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
    await fs.promises.writeFile(savePath, fileBuffer);

    // 4. 메타데이터 반환
    return {
      fileId,
      fileName,
      filePath: savePath,
      fileSize: fileBuffer.length,
      mimeType: fileInfo.file.mimetype,
      uploadedBy: userId,
      uploadedAt: new Date(fileInfo.file.timestamp * 1000),
      threadId,
      channelId,
      downloadedAt: new Date(),
    };
  }

  /**
   * Slack private URL에서 파일 다운로드
   */
  private async fetchFileFromSlack(
    url: string,
    client: WebClient
  ): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${client.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * 파일명 안전하게 처리 (특수문자 제거)
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * 스레드의 모든 파일 경로 조회
   */
  async getThreadFiles(threadId: string): Promise<string[]> {
    const threadDir = path.join(this.downloadDir, threadId);

    try {
      const files = await fs.promises.readdir(threadDir);
      return files.map(f => path.join(threadDir, f));
    } catch (error) {
      return [];
    }
  }
}
```

### 2. 슬랙 봇 통합

**위치**: `packages/cli/src/slack/slack-bot.ts`

```typescript
// 기존 slack-bot.ts에 추가

private fileDownloadService: SlackFileDownloadService;

private registerHandlers() {
  // ... 기존 핸들러

  // 파일 업로드 이벤트 리스닝
  this.app.event('file_shared', async ({ event, client }) => {
    await this.handleFileShared(event, client);
  });

  // 메시지와 함께 파일 업로드된 경우
  this.app.message(async ({ message, client }) => {
    if ('files' in message && message.files) {
      await this.handleMessageWithFiles(message, client);
    }
  });
}

/**
 * 파일 업로드 이벤트 처리
 */
private async handleFileShared(event: any, client: any) {
  try {
    const fileId = event.file_id;
    const channelId = event.channel_id;
    const userId = event.user_id;

    // 파일 다운로드
    const metadata = await this.fileDownloadService.downloadFile(
      client,
      fileId,
      event.file.name,
      event.thread_ts || event.ts,
      channelId,
      userId
    );

    this.logger.log(`📎 File downloaded: ${metadata.fileName} (${metadata.fileSize} bytes)`);

    // 슬랙에 다운로드 완료 메시지 전송 (선택사항)
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: event.thread_ts || event.ts,
      text: `✅ 파일 다운로드 완료: ${metadata.fileName} (${this.formatFileSize(metadata.fileSize)})`
    });
  } catch (error: any) {
    this.logger.error(`File download failed: ${error.message}`);
  }
}

/**
 * 메시지와 함께 업로드된 파일 처리
 */
private async handleMessageWithFiles(message: any, client: any) {
  const threadTs = message.thread_ts || message.ts;
  const channelId = message.channel;
  const userId = message.user;

  for (const file of message.files) {
    try {
      const metadata = await this.fileDownloadService.downloadFile(
        client,
        file.id,
        file.name,
        threadTs,
        channelId,
        userId
      );

      this.logger.log(`📎 File downloaded from message: ${metadata.fileName}`);
    } catch (error: any) {
      this.logger.error(`Failed to download file ${file.name}: ${error.message}`);
    }
  }
}

private formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
```

### 3. AI 에이전트 통합

**파일 경로를 컨텍스트에 자동 추가**

```typescript
// packages/cli/src/slack/slack-bot.ts의 processMessage 메서드 수정

private async processMessage(params: {
  text: string;
  threadTs: string;
  channelId: string;
  userId: string;
  client: any;
}) {
  // ... 기존 코드

  // 스레드의 업로드된 파일 조회
  const threadFiles = await this.fileDownloadService.getThreadFiles(params.threadTs);

  // AI 에이전트에게 파일 경로 전달
  let enhancedPrompt = params.text;

  if (threadFiles.length > 0) {
    enhancedPrompt += '\n\n📎 Uploaded files in this thread:\n';
    enhancedPrompt += threadFiles.map(f => `- ${f}`).join('\n');
    enhancedPrompt += '\n\nYou can read these files using the Read tool.';
  }

  // CrewX 도구 호출
  const result = await this.crewXTool.execute({
    prompt: enhancedPrompt,
    mode: this.mode,
    // ... 기타 옵션
  });

  // ... 응답 처리
}
```

### 4. 설정 관리

**위치**: `packages/cli/src/services/config.service.ts`

```typescript
// ConfigService에 추가

/**
 * 슬랙 파일 다운로드 디렉토리 조회
 */
getSlackFileDownloadDir(): string {
  // 환경변수 또는 기본값
  return process.env.CREWX_SLACK_FILE_DIR ||
         path.join(process.cwd(), '.crewx', 'slack-files');
}

/**
 * 파일 다운로드 자동 활성화 여부
 */
isSlackFileDownloadEnabled(): boolean {
  return process.env.CREWX_SLACK_FILE_DOWNLOAD !== 'false';
}

/**
 * 최대 파일 크기 (바이트)
 */
getSlackMaxFileSize(): number {
  const envValue = process.env.CREWX_SLACK_MAX_FILE_SIZE;
  return envValue ? parseInt(envValue, 10) : 10 * 1024 * 1024; // 기본 10MB (보안상 안전)
}
```

## 디렉토리 구조

```
.crewx/
└── slack-files/
    ├── 1234567890.123456/  # thread_ts
    │   ├── requirements.pdf
    │   ├── screenshot.png
    │   └── data.csv
    ├── 1234567890.234567/
    │   └── design.pdf
    └── metadata.json  # 선택사항: 파일 메타데이터 저장
```

### 메타데이터 저장 (선택사항)

```json
{
  "files": [
    {
      "fileId": "F0123456789",
      "fileName": "requirements.pdf",
      "filePath": ".crewx/slack-files/1234567890.123456/requirements.pdf",
      "fileSize": 245760,
      "mimeType": "application/pdf",
      "uploadedBy": "U099T076B5E",
      "uploadedAt": "2025-11-20T01:30:00Z",
      "threadId": "1234567890.123456",
      "channelId": "C01234567",
      "downloadedAt": "2025-11-20T01:30:05Z"
    }
  ]
}
```

## 구현 단계

### Phase 1: 기본 파일 다운로드 (필수)
**예상 시간**: 5-7시간

#### 1.1 SlackFileDownloadService 구현 (2-3시간)

- [ ] 파일 다운로드 로직
  - [ ] Slack API `files.info` + `url_private` 사용
  - [ ] **중복 다운로드 방지** (파일 존재 여부 체크)
  - [ ] 로컬 디렉토리 저장 (`.crewx/slack-files/{thread_ts}/`)
  - [ ] 파일명 안전 처리 (sanitization)

```typescript
async downloadFile(fileId: string, threadId: string): Promise<string> {
  const localPath = this.getLocalPath(fileId, threadId);

  // 🔑 중복 다운로드 방지
  if (fs.existsSync(localPath)) {
    this.logger.debug(`File already exists: ${localPath}`);
    return localPath;
  }

  // Slack API로 다운로드
  const fileInfo = await client.files.info({ file: fileId });
  const response = await fetch(fileInfo.file.url_private, {
    headers: { Authorization: `Bearer ${botToken}` },
  });

  await fs.writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  return localPath;
}
```

- [ ] 메타데이터 저장 (JSON 기반)
  - [ ] 파일 ID → 로컬 경로 매핑
  - [ ] 다운로드 시각, 사이즈 등 메타정보

#### 1.2 자동 다운로드 통합 (2-3시간)

- [ ] `slack-bot.ts` 파일 이벤트 핸들러 추가
  - [ ] `file_shared` 이벤트 리스닝 (실시간 업로드)
  - [ ] **히스토리 조회 시 파일 체크** (중간 참여 대응)
  - [ ] 메시지 + 파일 동시 업로드 처리

```typescript
// slack-bot.ts:356 이후 추가
const thread = await this.conversationHistory.fetchHistory(threadId, {
  limit: 100,
  excludeCurrent: true,
});

// 🆕 히스토리의 모든 파일 다운로드 보장 (중간 참여 대응)
for (const msg of thread.messages) {
  if (msg.metadata?.slack?.files) {
    for (const file of msg.metadata.slack.files) {
      await this.fileDownloadService.ensureFileDownloaded(
        file.id,
        threadId,
        this.slackClient
      );
    }
  }
}
```

#### 1.3 기본 테스트 (1시간)

- [ ] PDF 파일 업로드 테스트
- [ ] 이미지 파일 업로드 테스트
- [ ] **중복 다운로드 방지 테스트** (같은 파일 2번 업로드)
- [ ] **중간 참여 시나리오** (봇 없을 때 업로드된 파일)

### Phase 2: AI 에이전트 통합 (필수)
**예상 시간**: 2-3시간

**핵심 전략**: Layout 템플릿 기반 자동 통합 (platform='slack' 조건부)

#### 2.1 템플릿 컨텍스트 확장 (1시간)

**RenderContext에 slack 필드 추가**:
- 위치: `packages/cli/src/crewx.tool.ts:730-755` (templateContext 생성)
- 확인된 필드: `platform`, `session.platform` (codex_dev 검증 완료)

```typescript
const templateContext: RenderContext = {
  user_input: query,
  messages: contextMessages,
  mode: 'query',
  platform: platform, // ← 'cli' or 'slack'
  // ... 기존 필드들

  // 🆕 Slack 전용 필드 추가
  slack: platform === 'slack' ? {
    downloadedFiles: await this.getSlackDownloadedFiles(threadId),
  } : undefined,
};
```

#### 2.2 Layout 템플릿 수정 (30분)

**위치**: `templates/agents/default.yaml:79-87` (session 블록)

```yaml
<session mode="{{session.mode}}" platform="{{session.platform}}">
  {{#if session.options.length}}
  <cli_options>
    {{#each session.options}}
    <item>{{{this}}}</item>
    {{/each}}
  </cli_options>
  {{/if}}

  {{!-- 🆕 Slack 파일 다운로드 정보 추가 --}}
  {{#if (eq platform 'slack')}}
  {{#if slack.downloadedFiles.length}}
  <slack_files>
    <info>Files uploaded in this Slack thread have been automatically downloaded.</info>
    {{#each slack.downloadedFiles}}
    <file>
      <name>{{{this.fileName}}}</name>
      <local_path>{{{this.localPath}}}</local_path>
      <size>{{formatFileSize this.fileSize}}</size>
      <type>{{{this.mimeType}}}</type>
    </file>
    {{/each}}
    <usage_note>You can read these files using the Read tool with the local_path.</usage_note>
  </slack_files>
  {{/if}}
  {{/if}}
</session>
```

#### 2.3 FileDownloadService 메서드 추가 (30분)

```typescript
// packages/cli/src/crewx.tool.ts
private async getSlackDownloadedFiles(threadId?: string): Promise<SlackFileMetadata[]> {
  if (!threadId) return [];
  return await this.fileDownloadService.getThreadFilesMetadata(threadId);
}

// packages/cli/src/slack/services/slack-file-download.service.ts
async getThreadFilesMetadata(threadId: string): Promise<SlackFileMetadata[]> {
  // DB 또는 JSON에서 메타데이터 조회
  // Return: [{ fileName, localPath, fileSize, mimeType, ... }]
}
```

#### 2.4 Handlebars 헬퍼 추가 (15분)

**formatFileSize 헬퍼**:
- 위치: `packages/sdk/src/services/layout-renderer.service.ts:133-169`

```typescript
Handlebars.registerHelper('formatFileSize', (bytes: number) => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});
```

#### 2.5 테스트 (45분)

- [ ] 파일 업로드 후 AI 분석 요청
- [ ] 여러 파일 동시 분석
- [ ] 파일 없는 경우 정상 동작 확인
- [ ] CLI 플랫폼에서 slack 필드 undefined 확인

### Phase 3: CLI 명령어 추가
**예상 시간**: 2-3시간

**핵심**: 수동으로 파일 다운로드 가능

#### 3.1 CLI 명령어 구현 (1.5시간)

- [ ] `slack-file.handler.ts` 생성
  - [ ] `crewx slack:files --thread <id>` 구현
  - [ ] `--list` 옵션: 파일 목록만 표시
  - [ ] **환경변수 재활용** (`SLACK_BOT_TOKEN` 사용)
  - [ ] 중복 다운로드 방지 (기존 로직 재사용)

```typescript
// packages/cli/src/cli/slack-file.handler.ts
export async function handleSlackFiles(args: {
  thread: string;
  list?: boolean;
}) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    throw new Error('SLACK_BOT_TOKEN not found');
  }

  const [channel, threadTs] = args.thread.split(':');
  const service = new SlackFileDownloadService();

  if (args.list) {
    const files = await service.listThreadFiles(channel, threadTs);
    console.log(`📎 Files in thread:\n${files.map(f => `- ${f.name} (${f.size})`).join('\n')}`);
  } else {
    await service.downloadThreadFiles(channel, threadTs);
    console.log('✅ Files downloaded');
  }
}
```

#### 3.2 CLI 등록 (30분)

```typescript
// packages/cli/src/cli/index.ts
yargs.command(
  'slack:files',
  'Download or list Slack thread files',
  (yargs) => {
    return yargs
      .option('thread', {
        alias: 't',
        type: 'string',
        description: 'Thread ID (format: channel:timestamp)',
        required: true,
      })
      .option('list', {
        alias: 'l',
        type: 'boolean',
        description: 'List files only (do not download)',
        default: false,
      });
  },
  handleSlackFiles
);
```

#### 3.3 테스트 (30분)

- [ ] 파일 목록 조회 테스트
- [ ] 파일 다운로드 테스트
- [ ] **중복 다운로드 방지 확인** (이미 다운로드된 파일)

### Phase 4: 설정 및 제한
**예상 시간**: 2-3시간

- [ ] `ConfigService`에 설정 추가
  - [ ] 다운로드 디렉토리 설정
  - [ ] 파일 크기 제한
  - [ ] 파일 타입 필터링 (선택사항)
- [ ] 환경변수 문서화
- [ ] `.gitignore`에 `.crewx/slack-files/` 추가

### Phase 5: 에러 처리 및 로깅
**예상 시간**: 2-3시간

- [ ] 파일 다운로드 실패 처리
  - [ ] 권한 없음
  - [ ] 파일 크기 초과
  - [ ] 디스크 공간 부족
  - [ ] **Rate limiting (429 응답)**
- [ ] 슬랙 사용자에게 에러 메시지 전송
- [ ] 로깅 강화
  - [ ] 다운로드 성공/실패 로그
  - [ ] 파일 메타데이터 로그
  - [ ] **중복 스킵 로그**

### Phase 6: 고급 기능 (선택사항)
**예상 시간**: 4-6시간

- [ ] 파일 메타데이터 JSON 저장
- [ ] 오래된 파일 자동 정리 (예: 7일 후 삭제)
- [ ] 파일 다운로드 진행률 표시
- [ ] 파일 미리보기 링크 생성

## 보안 고려사항

### 1. 파일 크기 제한
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (보안 권장)

if (fileInfo.file.size > MAX_FILE_SIZE) {
  throw new Error(`File too large: ${fileInfo.file.size} bytes (max: ${MAX_FILE_SIZE})`);
}
```

### 2. 파일 타입 검증
```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/json',
  // ... 필요한 타입 추가
];

if (!ALLOWED_MIME_TYPES.includes(fileInfo.file.mimetype)) {
  throw new Error(`File type not allowed: ${fileInfo.file.mimetype}`);
}
```

### 3. 경로 인젝션 방지
```typescript
private sanitizeFileName(fileName: string): string {
  // 경로 구분자 제거
  const safeName = fileName.replace(/[\/\\]/g, '_');

  // 특수문자 제거 (알파벳, 숫자, ., _, - 만 허용)
  return safeName.replace(/[^a-zA-Z0-9._-]/g, '_');
}
```

### 4. 디스크 공간 확인
```typescript
async checkDiskSpace(): Promise<boolean> {
  const stats = await fs.promises.statfs(this.downloadDir);
  const availableSpace = stats.bavail * stats.bsize;
  const MIN_SPACE = 100 * 1024 * 1024; // 100MB 최소 여유 공간

  return availableSpace > MIN_SPACE;
}
```

## 환경변수 설정

```bash
# .env 또는 .env.slack

# 슬랙 파일 다운로드 디렉토리
CREWX_SLACK_FILE_DIR=.crewx/slack-files

# 파일 다운로드 활성화 (기본: true)
CREWX_SLACK_FILE_DOWNLOAD=true

# 최대 파일 크기 (바이트, 기본: 10MB)
CREWX_SLACK_MAX_FILE_SIZE=52428800

# 파일 자동 삭제 기간 (일, 기본: 7일)
CREWX_SLACK_FILE_RETENTION_DAYS=7
```

## 사용 예시

### 예시 1: PDF 분석
```
User: [requirements.pdf 업로드]
User: @CrewX 이 요구사항 문서를 분석해줘

Bot: 📎 파일 다운로드 완료: requirements.pdf (245KB)
Bot: 요구사항 문서를 분석했습니다.

     주요 기능:
     1. 사용자 인증 시스템
     2. 데이터 대시보드
     3. 보고서 생성

     기술 스택 권장사항:
     - Backend: NestJS
     - Frontend: React + TypeScript
     - Database: PostgreSQL
```

### 예시 2: 이미지 분석
```
User: [error-screenshot.png 업로드]
User: @CrewX 이 에러가 뭐야?

Bot: 📎 파일 다운로드 완료: error-screenshot.png (128KB)
Bot: 스크린샷을 분석한 결과, TypeScript 컴파일 에러입니다.

     에러 내용:
     - TS2339: Property 'xyz' does not exist on type 'ABC'

     해결 방법:
     1. ABC 타입에 xyz 속성 추가
     2. 또는 타입 단언 사용
```

### 예시 3: 여러 파일 동시 분석
```
User: [design.pdf, mockup.png, spec.docx 업로드]
User: @CrewX 이 디자인 문서들을 바탕으로 구현 계획을 세워줘

Bot: 📎 파일 다운로드 완료:
     - design.pdf (1.2MB)
     - mockup.png (456KB)
     - spec.docx (89KB)

Bot: 3개 문서를 분석하여 구현 계획을 작성했습니다...
```

## 테스트 계획

### 단위 테스트
**위치**: `packages/cli/tests/slack/slack-file-download.service.spec.ts`

```typescript
describe('SlackFileDownloadService', () => {
  it('should download file from Slack', async () => {
    // Mock Slack API
    // Test file download
    // Verify file saved to disk
  });

  it('should sanitize file names', () => {
    const service = new SlackFileDownloadService(configService);
    expect(service['sanitizeFileName']('../../etc/passwd')).toBe('______etc_passwd');
  });

  it('should reject files exceeding size limit', async () => {
    // Mock large file
    // Expect error
  });

  it('should get all files in thread', async () => {
    // Create test files
    // Call getThreadFiles
    // Verify file list
  });
});
```

### 통합 테스트
**위치**: `packages/cli/tests/slack/slack-bot-file-integration.spec.ts`

```typescript
describe('SlackBot File Integration', () => {
  it('should download file when user uploads to thread', async () => {
    // Mock file_shared event
    // Verify handleFileShared called
    // Verify file saved
  });

  it('should include file paths in AI prompt', async () => {
    // Upload file
    // Send message to AI
    // Verify prompt includes file path
  });

  it('should handle multiple file uploads', async () => {
    // Upload 3 files
    // Verify all downloaded
    // Verify all paths in prompt
  });
});
```

### E2E 테스트
**수동 테스트 시나리오**

1. PDF 파일 업로드 → AI 분석 요청
2. 이미지 파일 업로드 → AI 설명 요청
3. CSV 파일 업로드 → AI 데이터 분석 요청
4. 큰 파일 업로드 → 에러 메시지 확인
5. 허용되지 않는 파일 타입 → 에러 메시지 확인

## 파일 목록

### 신규 파일
- `packages/cli/src/slack/services/slack-file-download.service.ts`
- `packages/cli/tests/slack/slack-file-download.service.spec.ts`
- `packages/cli/tests/slack/slack-bot-file-integration.spec.ts`

### 수정 파일
- `packages/cli/src/slack/slack-bot.ts`
- `packages/cli/src/services/config.service.ts`
- `packages/cli/.gitignore` (`.crewx/slack-files/` 추가)

### 문서 파일
- `README.md` (슬랙 파일 다운로드 기능 설명 추가)
- `docs/slack-integration.md` (신규 또는 업데이트)

## 종속성

### NPM 패키지
- `@slack/bolt` (이미 설치됨)
- `@slack/web-api` (이미 설치됨)
- `node:fs/promises` (Node.js 내장)
- `node:path` (Node.js 내장)

### Slack API 권한
```json
{
  "scopes": {
    "bot": [
      "files:read",        // 파일 정보 조회
      "files:write",       // 파일 다운로드 (private URL 접근)
      "channels:history",  // 채널 메시지 읽기
      "groups:history",    // 비공개 채널 메시지 읽기
      "im:history",        // DM 메시지 읽기
      "mpim:history"       // 그룹 DM 메시지 읽기
    ]
  }
}
```

## 성능 고려사항

### 1. 비동기 다운로드
- 파일 다운로드는 백그라운드에서 비동기 처리
- 사용자 메시지 응답을 블로킹하지 않음

### 2. 다운로드 큐
```typescript
// 선택사항: 많은 파일 동시 업로드 시 큐 처리
private downloadQueue: Queue<FileDownloadTask> = new Queue();

async queueDownload(task: FileDownloadTask) {
  await this.downloadQueue.enqueue(task);
  this.processQueue(); // 백그라운드 처리
}
```

### 3. 캐싱
- 동일 파일 재다운로드 방지
- 파일 ID 기반 중복 체크

### 4. 디스크 공간 관리
- 오래된 파일 자동 삭제 (7일 기본)
- 디스크 공간 모니터링

## 에러 처리

### 1. 파일 다운로드 실패
```typescript
try {
  await this.fileDownloadService.downloadFile(...);
} catch (error) {
  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: `❌ 파일 다운로드 실패: ${error.message}`
  });
}
```

### 2. 권한 부족
```typescript
if (!fileInfo.file.url_private) {
  throw new Error('파일 다운로드 권한이 없습니다.');
}
```

### 3. 디스크 공간 부족
```typescript
const hasSpace = await this.checkDiskSpace();
if (!hasSpace) {
  throw new Error('디스크 공간이 부족합니다.');
}
```

## 장점 및 단점

### 장점
1. ✅ **자동화**: 사용자가 파일 경로를 직접 입력할 필요 없음
2. ✅ **컨텍스트 유지**: 스레드별로 파일 관리
3. ✅ **AI 활용**: AI가 자동으로 파일을 읽고 분석 가능
4. ✅ **보안**: 로컬에 저장하여 슬랙 권한 문제 회피
5. ✅ **오프라인 접근**: 슬랙 API 없이도 파일 접근 가능

### 단점
1. ⚠️ **디스크 공간**: 파일이 계속 쌓이면 공간 부족 가능 (자동 정리로 해결)
2. ⚠️ **슬랙 권한**: `files:read`, `files:write` 권한 필요
3. ⚠️ **네트워크 의존**: 파일 다운로드 시 네트워크 필요
4. ⚠️ **동기화**: 슬랙에서 파일 삭제 시 로컬 파일은 남아있음

## 대안 분석

### 대안 1: 파일 다운로드 없이 URL만 전달
**개념**: AI에게 슬랙 파일 URL만 전달

**장점**:
- 디스크 공간 절약
- 구현 간단

**단점**:
- AI가 슬랙 파일에 직접 접근 불가 (권한 문제)
- 오프라인 접근 불가
- 파일 만료 시 접근 불가

**결론**: 현실적으로 사용 불가

### 대안 2: 임시 다운로드 후 삭제
**개념**: AI 처리 직후 파일 삭제

**장점**:
- 디스크 공간 절약
- 보안 강화

**단점**:
- 스레드 이어서 대화 시 파일 재다운로드 필요
- 컨텍스트 유지 어려움

**결론**: UX 저하

### 대안 3: 파일 메타데이터만 저장
**개념**: 파일 내용은 저장하지 않고 메타데이터만 기록

**장점**:
- 디스크 공간 거의 사용 안 함
- 빠름

**단점**:
- AI가 파일 내용 접근 불가
- 요구사항 충족 못 함

**결론**: 기능 불충분

### 선택: 파일 다운로드 + 자동 정리 (현재 제안)
**이유**:
1. AI가 파일 내용 접근 가능
2. 스레드 컨텍스트 유지
3. 자동 정리로 디스크 공간 관리
4. 오프라인 접근 가능

## 타임라인

### Short-term (1주)
- Phase 1-3 구현 (기본 파일 다운로드, AI 통합, CLI 명령어)
- 기본 테스트
- 문서 작성

### Mid-term (2주)
- Phase 4-5 구현 (설정 및 제한, 에러 처리)
- 통합 테스트
- E2E 테스트

### Long-term (선택사항)
- Phase 6 구현 (고급 기능)
- 성능 최적화
- 사용자 피드백 반영

## 관련 파일

### 수정 필요
- `packages/cli/src/slack/slack-bot.ts`
- `packages/cli/src/services/config.service.ts`
- `packages/cli/.gitignore`

### 신규 생성
- `packages/cli/src/slack/services/slack-file-download.service.ts`
- `packages/cli/tests/slack/slack-file-download.service.spec.ts`

## 다음 단계

- [ ] 팀 리뷰 및 승인
- [ ] Phase 1 구현 시작
- [ ] Slack App Manifest 업데이트 (권한 추가)
- [ ] 개발 환경 테스트
- [ ] 프로덕션 배포

## 참고사항

### Slack API 참고
- [Slack Files API](https://api.slack.com/methods/files.info)
- [Slack Events API - file_shared](https://api.slack.com/events/file_shared)
- [Slack File Download](https://api.slack.com/types/file#authentication)

### 유사 사례
- GitHub Slack App의 파일 미리보기
- Notion Slack App의 페이지 링크 확장

## 결론

이 기능은 **슬랙 파일 업로드 → AI 자동 분석**이라는 자연스러운 워크플로우를 제공합니다. 사용자는 파일을 업로드하고 AI에게 분석을 요청하기만 하면 되며, 파일 경로나 권한 문제를 신경 쓸 필요가 없습니다.

**핵심 가치**:
> "슬랙에 파일 올리면 AI가 바로 읽는다. 간단하고 자연스럽다."

**실행 계획**:
1. Phase 1-3 우선 구현 (기본 기능)
2. 실사용 테스트 및 피드백
3. Phase 4-5 순차 구현 (안정성)
4. Phase 6 선택적 구현 (고급 기능)
