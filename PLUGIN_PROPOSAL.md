# CrewX 플러그인 시스템 설계안

## 📋 옵션 비교표

| 옵션 | 난이도 | 개발시간 | 유지보수성 | 사용자 편의성 | 확장성 | 추천도 |
|-----|--------|----------|------------|---------------|--------|--------|
| 1. YAML 기반 동적 로딩 | ⚡⚡ 중하 | 2-3일 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ **권장** |
| 2. NPM 패키지 플러그인 | ⚡⚡⚡⚡ 중상 | 7-10일 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 3. JavaScript 플러그인 파일 | ⚡⚡⚡ 중 | 4-5일 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## ✅ 옵션 1: YAML 기반 동적 프로바이더 로딩 (권장)

### 난이도: ⚡⚡ 중하 (2-3일)

### 왜 이 방법이 최선인가?

✅ **장점**:
- CrewX의 기존 YAML 기반 설정 패턴과 일관성 유지
- 사용자가 코드 작성 불필요 (YAML만 수정)
- 빠른 구현 (기존 BaseAIProvider 재사용)
- 타입 안전성 (Zod/Ajv 스키마 검증)
- NestJS DI와 충돌 없음

❌ **단점**:
- 고급 커스터마이징 제한 (error parsing 등)
- 복잡한 프로바이더는 여전히 코드 작성 필요

### 구현 상세

#### 1. YAML 스키마 확장

```yaml
# ~/.crewx/crewx.yaml 또는 프로젝트 루트 crewx.yaml

providers:
  # 내장 프로바이더 (기존 claude, gemini, copilot)
  - id: claude
    type: builtin  # 생략 가능 (기본값)

  # 외부 CLI 프로바이더 플러그인
  - id: aider
    type: plugin
    cli_command: aider  # CLI 실행 파일명
    display_name: Aider AI  # 사용자에게 표시될 이름
    description: Terminal-based AI coding assistant

    # CLI 인자 설정
    query_args:
      - "--yes"
      - "--no-auto-commits"
      - "--message"  # 마지막 인자는 프롬프트 placeholder

    execute_args:
      - "--yes"
      - "--auto-commits"
      - "--message"

    # 프롬프트 전달 방식
    prompt_in_args: true  # true: args로 전달, false: stdin으로 전달

    # 타임아웃 설정 (ms)
    timeout:
      query: 600000   # 10분
      execute: 1200000  # 20분

    # 에러 감지 패턴 (선택사항)
    error_patterns:
      - pattern: "session limit"
        type: session_limit
        message: "Aider session limit reached. Please try again later."
      - pattern: "authentication required"
        type: auth_required
        message: "Aider authentication required. Please run 'aider login'."

    # 설치 확인 메시지
    not_installed_message: "Aider CLI is not installed. Install with: pip install aider-chat"

  - id: cursor
    type: plugin
    cli_command: cursor-cli
    display_name: Cursor AI
    query_args: ["--mode", "query", "-p"]
    execute_args: ["--mode", "execute", "-p"]
    prompt_in_args: true
    timeout:
      query: 300000
      execute: 900000
    not_installed_message: "Cursor CLI not found. Please install from https://cursor.sh"

agents:
  # 플러그인 프로바이더 사용
  - id: aider_expert
    provider: aider  # providers에서 정의한 id 참조
    name: "Aider Expert"
    specialties:
      - "Git integration"
      - "Auto-commit generation"
    capabilities:
      - implementation
      - code_review
```

#### 2. 동적 프로바이더 생성 코드

**`src/providers/dynamic-provider.factory.ts`** (신규 파일):

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse } from './ai-provider.interface';

export interface PluginProviderConfig {
  id: string;
  type: 'plugin';
  cli_command: string;
  display_name?: string;
  description?: string;
  query_args: string[];
  execute_args: string[];
  prompt_in_args: boolean;
  timeout?: {
    query: number;
    execute: number;
  };
  error_patterns?: Array<{
    pattern: string;
    type: string;
    message: string;
  }>;
  not_installed_message?: string;
}

/**
 * 동적 프로바이더 팩토리
 * YAML 설정으로부터 런타임에 프로바이더 생성
 */
@Injectable()
export class DynamicProviderFactory {
  private logger = new Logger(DynamicProviderFactory.name);

  /**
   * YAML 설정으로부터 동적 프로바이더 인스턴스 생성
   */
  createProvider(config: PluginProviderConfig): BaseAIProvider {
    this.logger.log(`Creating dynamic provider: ${config.id}`);

    // BaseAIProvider를 상속받는 동적 클래스 생성
    class DynamicAIProvider extends BaseAIProvider {
      readonly name = config.id as any;

      constructor() {
        super(`DynamicProvider:${config.id}`);
      }

      protected getCliCommand(): string {
        return config.cli_command;
      }

      protected getDefaultArgs(): string[] {
        return config.query_args || [];
      }

      protected getExecuteArgs(): string[] {
        return config.execute_args || [];
      }

      protected getPromptInArgs(): boolean {
        return config.prompt_in_args ?? false;
      }

      protected getNotInstalledMessage(): string {
        return (
          config.not_installed_message ||
          `${config.display_name || config.id} CLI is not installed.`
        );
      }

      protected getDefaultQueryTimeout(): number {
        return config.timeout?.query ?? 600000;
      }

      protected getDefaultExecuteTimeout(): number {
        return config.timeout?.execute ?? 1200000;
      }

      // 에러 패턴 매칭 (선택사항)
      public parseProviderError(
        stderr: string,
        stdout: string,
      ): { error: boolean; message: string } {
        if (!config.error_patterns) {
          return super.parseProviderError(stderr, stdout);
        }

        const combinedOutput = stderr || stdout;

        // 설정된 에러 패턴 검사
        for (const errorPattern of config.error_patterns) {
          if (combinedOutput.includes(errorPattern.pattern)) {
            return {
              error: true,
              message: errorPattern.message,
            };
          }
        }

        // 기본 에러 파싱
        return super.parseProviderError(stderr, stdout);
      }
    }

    return new DynamicAIProvider();
  }

  /**
   * YAML 설정 검증 (Zod 스키마)
   */
  validateConfig(config: any): config is PluginProviderConfig {
    // TODO: Zod 스키마로 검증
    return (
      config.id &&
      config.cli_command &&
      Array.isArray(config.query_args) &&
      Array.isArray(config.execute_args)
    );
  }
}
```

#### 3. AIProviderService 수정

**`src/ai-provider.service.ts`** 수정:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIProvider } from './providers/ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { DynamicProviderFactory, PluginProviderConfig } from './providers/dynamic-provider.factory';
import { AgentConfigService } from './config/agent-config.service';

@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly providers = new Map<string, AIProvider>();
  private availableProviders: string[] = [];

  constructor(
    private readonly claudeProvider: ClaudeProvider,
    private readonly copilotProvider: CopilotProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly dynamicProviderFactory: DynamicProviderFactory,
    private readonly agentConfigService: AgentConfigService,
  ) {}

  async onModuleInit() {
    // 1. 내장 프로바이더 등록
    this.registerProvider(this.claudeProvider);
    this.registerProvider(this.copilotProvider);
    this.registerProvider(this.geminiProvider);

    // 2. YAML에서 플러그인 프로바이더 로딩
    await this.loadPluginProviders();
  }

  /**
   * YAML 설정에서 플러그인 프로바이더 동적 로딩
   */
  private async loadPluginProviders(): Promise<void> {
    try {
      const config = await this.agentConfigService.loadAgentConfig();

      if (!config.providers) {
        this.logger.log('No plugin providers defined in crewx.yaml');
        return;
      }

      for (const providerConfig of config.providers) {
        // 내장 프로바이더는 스킵
        if (providerConfig.type !== 'plugin') {
          continue;
        }

        // 설정 검증
        if (!this.dynamicProviderFactory.validateConfig(providerConfig)) {
          this.logger.warn(`Invalid plugin provider config: ${providerConfig.id}`);
          continue;
        }

        // 동적 프로바이더 생성 및 등록
        const provider = this.dynamicProviderFactory.createProvider(providerConfig as PluginProviderConfig);
        this.registerProvider(provider);
        this.logger.log(`✅ Registered plugin provider: ${providerConfig.id}`);
      }
    } catch (error) {
      this.logger.error('Failed to load plugin providers:', error);
    }
  }

  private registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered AI provider: ${provider.name}`);
  }

  // 나머지 메서드는 기존 그대로...
}
```

#### 4. AgentConfigService에 providers 스키마 추가

**`src/config/agent-config.service.ts`** 수정 (providers 섹션 추가):

```typescript
export interface AgentConfig {
  agents: AgentDefinition[];
  providers?: PluginProviderConfig[];  // 새로운 필드
}

// Zod 스키마 확장
const PluginProviderSchema = z.object({
  id: z.string(),
  type: z.literal('plugin'),
  cli_command: z.string(),
  display_name: z.string().optional(),
  description: z.string().optional(),
  query_args: z.array(z.string()),
  execute_args: z.array(z.string()),
  prompt_in_args: z.boolean().default(false),
  timeout: z
    .object({
      query: z.number().optional(),
      execute: z.number().optional(),
    })
    .optional(),
  error_patterns: z
    .array(
      z.object({
        pattern: z.string(),
        type: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  not_installed_message: z.string().optional(),
});

const AgentConfigSchema = z.object({
  agents: z.array(AgentDefinitionSchema),
  providers: z.array(PluginProviderSchema).optional(),  // 추가
});
```

---

### 사용 시나리오 예시

#### 1. Aider 프로바이더 추가

```bash
# 1. Aider CLI 설치
pip install aider-chat

# 2. crewx.yaml에 플러그인 프로바이더 정의
cat >> ~/.crewx/crewx.yaml <<EOF
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
      - "Auto-commit messages"
    capabilities:
      - implementation
EOF

# 3. CrewX에서 즉시 사용 가능 (코드 변경 없음!)
crewx doctor  # aider가 available providers에 표시됨
crewx query "@aider_dev refactor this function"
```

#### 2. Cursor CLI 프로바이더 추가

```yaml
providers:
  - id: cursor
    type: plugin
    cli_command: cursor-cli
    query_args: ["--mode", "query", "-p"]
    execute_args: ["--mode", "execute", "-p"]
    prompt_in_args: true
```

---

### 구현 단계별 체크리스트

**Phase 1: 코어 기능 (1일)**
- [ ] `DynamicProviderFactory` 구현
- [ ] `AIProviderService.loadPluginProviders()` 구현
- [ ] `AgentConfigService`에 providers 스키마 추가
- [ ] 기본 테스트 작성

**Phase 2: 검증 및 에러 처리 (0.5일)**
- [ ] Zod 스키마 검증
- [ ] 에러 패턴 매칭 구현
- [ ] 순환 의존성 체크 (agents → providers)

**Phase 3: CLI 통합 (0.5일)**
- [ ] `crewx doctor`에서 플러그인 프로바이더 표시
- [ ] `crewx list-agents`에 플러그인 정보 추가
- [ ] 플러그인 프로바이더 에러 메시지 개선

**Phase 4: 문서화 및 예제 (1일)**
- [ ] README에 플러그인 추가 가이드 작성
- [ ] Aider, Cursor 등 인기 CLI 예제 제공
- [ ] 트러블슈팅 가이드 작성

**총 소요 시간: 2-3일**

---

## 🔧 옵션 2: NPM 패키지 플러그인 시스템

### 난이도: ⚡⚡⚡⚡ 중상 (7-10일)

### 개념

외부 NPM 패키지로 프로바이더를 배포하고, 사용자가 `npm install`로 설치.

```bash
npm install crewx-plugin-aider
```

### 구현 아키텍처

**1. 플러그인 인터페이스 정의**:

```typescript
// @crewx/plugin-sdk (새로운 패키지)
export interface CrewXPlugin {
  id: string;
  version: string;
  provider: AIProvider;  // BaseAIProvider 상속
  metadata: {
    displayName: string;
    description: string;
    author: string;
    homepage?: string;
  };
}

export abstract class BasePlugin implements CrewXPlugin {
  abstract id: string;
  abstract version: string;
  abstract provider: AIProvider;
  abstract metadata: PluginMetadata;

  // 플러그인 초기화 훅
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
}
```

**2. 플러그인 패키지 예시** (`crewx-plugin-aider`):

```typescript
// node_modules/crewx-plugin-aider/src/index.ts
import { BasePlugin, AIProvider } from '@crewx/plugin-sdk';
import { AiderProvider } from './aider.provider';

export default class AiderPlugin extends BasePlugin {
  id = 'aider';
  version = '1.0.0';
  provider = new AiderProvider();

  metadata = {
    displayName: 'Aider AI',
    description: 'Git-aware AI coding assistant',
    author: 'CrewX Community',
    homepage: 'https://github.com/crewx-plugins/aider',
  };

  async onLoad() {
    console.log('Aider plugin loaded!');
  }
}

// package.json
{
  "name": "crewx-plugin-aider",
  "version": "1.0.0",
  "main": "dist/index.js",
  "keywords": ["crewx", "plugin", "aider"],
  "peerDependencies": {
    "@crewx/plugin-sdk": "^1.0.0"
  }
}
```

**3. 플러그인 로더** (`src/plugin/plugin-loader.service.ts`):

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { readdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PluginLoaderService {
  private logger = new Logger(PluginLoaderService.name);
  private loadedPlugins = new Map<string, CrewXPlugin>();

  async loadPlugins(): Promise<void> {
    // 1. node_modules에서 crewx-plugin-* 패키지 검색
    const pluginPackages = this.discoverPluginPackages();

    for (const packageName of pluginPackages) {
      try {
        // 2. 동적 import로 플러그인 로드
        const pluginModule = await import(packageName);
        const Plugin = pluginModule.default;

        if (!Plugin || typeof Plugin !== 'function') {
          this.logger.warn(`Invalid plugin: ${packageName}`);
          continue;
        }

        // 3. 플러그인 인스턴스 생성
        const plugin = new Plugin();

        // 4. 검증
        if (!this.validatePlugin(plugin)) {
          this.logger.warn(`Plugin validation failed: ${packageName}`);
          continue;
        }

        // 5. onLoad 훅 실행
        if (plugin.onLoad) {
          await plugin.onLoad();
        }

        this.loadedPlugins.set(plugin.id, plugin);
        this.logger.log(`✅ Loaded plugin: ${plugin.id} (${packageName})`);
      } catch (error) {
        this.logger.error(`Failed to load plugin ${packageName}:`, error);
      }
    }
  }

  private discoverPluginPackages(): string[] {
    try {
      const nodeModulesPath = join(process.cwd(), 'node_modules');
      const packages = readdirSync(nodeModulesPath);

      // crewx-plugin-* 패턴 필터링
      return packages.filter(pkg => pkg.startsWith('crewx-plugin-'));
    } catch (error) {
      this.logger.error('Failed to discover plugins:', error);
      return [];
    }
  }

  private validatePlugin(plugin: any): plugin is CrewXPlugin {
    return (
      plugin.id &&
      plugin.version &&
      plugin.provider &&
      typeof plugin.provider.query === 'function'
    );
  }

  getPlugin(id: string): CrewXPlugin | undefined {
    return this.loadedPlugins.get(id);
  }

  getAllPlugins(): CrewXPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }
}
```

**4. AIProviderService 통합**:

```typescript
@Injectable()
export class AIProviderService implements OnModuleInit {
  constructor(
    private readonly pluginLoader: PluginLoaderService,
    // ...
  ) {}

  async onModuleInit() {
    // 내장 프로바이더 등록
    this.registerProvider(this.claudeProvider);

    // 플러그인 로드
    await this.pluginLoader.loadPlugins();

    // 플러그인 프로바이더 등록
    for (const plugin of this.pluginLoader.getAllPlugins()) {
      this.registerProvider(plugin.provider);
    }
  }
}
```

### ✅ 장점
- 강력한 확장성 (NPM 생태계 활용)
- 플러그인 버전 관리 용이
- 커뮤니티 기여 활성화
- 고급 기능 구현 가능 (TypeScript 코드)

### ❌ 단점
- 구현 복잡도 높음 (7-10일)
- 사용자가 NPM 패키지 설치 필요
- 플러그인 SDK 유지보수 부담
- 플러그인 보안 검증 필요

### 사용 시나리오

```bash
# 1. 플러그인 설치
npm install -g crewx-plugin-aider

# 2. 설정 (선택사항, 자동 감지됨)
cat >> ~/.crewx/crewx.yaml <<EOF
agents:
  - id: aider_dev
    provider: aider  # 플러그인에서 제공
EOF

# 3. 사용
crewx query "@aider_dev implement feature X"
```

---

## 🔌 옵션 3: JavaScript 플러그인 파일 시스템

### 난이도: ⚡⚡⚡ 중 (4-5일)

### 개념

사용자가 `~/.crewx/plugins/` 디렉토리에 `.js` 파일을 작성하면 CrewX가 로드.

### 구현 아키텍처

**1. 플러그인 파일 구조**:

```javascript
// ~/.crewx/plugins/aider.js
module.exports = {
  id: 'aider',
  provider: {
    name: 'aider',
    cliCommand: 'aider',
    queryArgs: ['--yes', '--no-auto-commits', '--message'],
    executeArgs: ['--yes', '--auto-commits', '--message'],
    promptInArgs: true,
    timeout: {
      query: 600000,
      execute: 1200000,
    },
    parseError: (stderr, stdout) => {
      // 커스텀 에러 파싱 로직
      if (stderr.includes('session limit')) {
        return {
          error: true,
          message: 'Aider session limit reached',
        };
      }
      return { error: false, message: '' };
    },
  },
  metadata: {
    displayName: 'Aider AI',
    description: 'Git-aware AI assistant',
  },
};
```

**2. 플러그인 로더** (`src/plugin/js-plugin-loader.service.ts`):

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

@Injectable()
export class JsPluginLoaderService {
  private logger = new Logger(JsPluginLoaderService.name);
  private pluginsDir = join(homedir(), '.crewx', 'plugins');

  async loadJsPlugins(): Promise<AIProvider[]> {
    if (!existsSync(this.pluginsDir)) {
      this.logger.log('No plugins directory found, skipping plugin load');
      return [];
    }

    const providers: AIProvider[] = [];
    const files = readdirSync(this.pluginsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const pluginPath = join(this.pluginsDir, file);

        // 동적 require (CommonJS 모듈)
        delete require.cache[pluginPath]; // 캐시 무효화
        const pluginConfig = require(pluginPath);

        // 검증
        if (!this.validatePluginConfig(pluginConfig)) {
          this.logger.warn(`Invalid plugin config: ${file}`);
          continue;
        }

        // DynamicProviderFactory로 프로바이더 생성
        const provider = this.dynamicProviderFactory.createProvider({
          id: pluginConfig.id,
          type: 'plugin',
          cli_command: pluginConfig.provider.cliCommand,
          query_args: pluginConfig.provider.queryArgs,
          execute_args: pluginConfig.provider.executeArgs,
          prompt_in_args: pluginConfig.provider.promptInArgs,
          timeout: pluginConfig.provider.timeout,
          // 커스텀 에러 파싱 함수 주입
          customErrorParser: pluginConfig.provider.parseError,
        });

        providers.push(provider);
        this.logger.log(`✅ Loaded JS plugin: ${file} (${pluginConfig.id})`);
      } catch (error) {
        this.logger.error(`Failed to load plugin ${file}:`, error);
      }
    }

    return providers;
  }

  private validatePluginConfig(config: any): boolean {
    return (
      config.id &&
      config.provider &&
      config.provider.cliCommand &&
      Array.isArray(config.provider.queryArgs)
    );
  }
}
```

**3. DynamicProviderFactory 확장** (커스텀 함수 지원):

```typescript
export interface PluginProviderConfig {
  // ... 기존 필드들
  customErrorParser?: (stderr: string, stdout: string) => { error: boolean; message: string };
  customToolParser?: (content: string) => { isToolUse: boolean; toolName?: string; toolInput?: any };
}

class DynamicAIProvider extends BaseAIProvider {
  // ...

  public parseProviderError(stderr: string, stdout: string): { error: boolean; message: string } {
    // 커스텀 파서가 있으면 우선 사용
    if (config.customErrorParser) {
      return config.customErrorParser(stderr, stdout);
    }

    // 기본 파서
    return super.parseProviderError(stderr, stdout);
  }
}
```

### ✅ 장점
- 중간 정도의 구현 복잡도
- 사용자 커스터마이징 가능 (JS 코드)
- NPM 설치 불필요 (파일 복사만으로 충분)
- YAML보다 유연함

### ❌ 단점
- 사용자가 JavaScript 작성 필요
- 타입 안전성 없음
- 플러그인 보안 검증 어려움
- CommonJS vs ESM 호환성 문제

### 사용 시나리오

```bash
# 1. 플러그인 디렉토리 생성
mkdir -p ~/.crewx/plugins

# 2. 플러그인 파일 작성
cat > ~/.crewx/plugins/aider.js <<'EOF'
module.exports = {
  id: 'aider',
  provider: {
    name: 'aider',
    cliCommand: 'aider',
    queryArgs: ['--yes', '--no-auto-commits', '--message'],
    executeArgs: ['--yes', '--auto-commits', '--message'],
    promptInArgs: true,
  },
};
EOF

# 3. CrewX에서 즉시 사용
crewx doctor  # aider 자동 감지
```

---

## 📊 최종 권장사항

### ✅ **즉시 구현 (v0.1.3~0.1.4)**: 옵션 1 - YAML 기반 동적 로딩

**이유**:
1. ⭐ **빠른 구현** (2-3일) - CrewX 0.1.2 초기 단계에 적합
2. ⭐ **기존 패턴과 일관성** - agents.yaml과 동일한 설정 방식
3. ⭐ **사용자 편의성** - 코드 작성 불필요, YAML만 수정
4. ⭐ **검증 가능** - Zod 스키마로 타입 안전성 보장
5. ⭐ **확장 가능** - 나중에 NPM 플러그인 시스템으로 마이그레이션 가능

**다음 단계**:
- 옵션 1 구현 후 사용자 피드백 수집
- 커뮤니티에서 고급 커스터마이징 요구 발생 시 옵션 2(NPM 플러그인) 추가

### 🔮 **장기 로드맵 (v1.0+)**: 옵션 2 - NPM 플러그인 시스템

옵션 1로 프로토타입 검증 후, 커뮤니티가 활성화되면 NPM 플러그인 시스템 추가:
- `@crewx/plugin-sdk` 패키지 발행
- 공식 플러그인 레지스트리 구축
- 플러그인 검증 및 보안 체크

---

## 🚀 즉시 실행 가능한 액션

### Phase 1: 프로토타입 (1일)
```bash
# 1. DynamicProviderFactory 구현
# 2. crewx.yaml에 providers 섹션 추가
# 3. 간단한 테스트 (echo CLI로 mock)
```

### Phase 2: Aider 통합 테스트 (0.5일)
```bash
# 1. Aider CLI 설치
pip install aider-chat

# 2. crewx.yaml 설정 추가
# 3. crewx doctor로 확인
# 4. 실제 쿼리 테스트
```

### Phase 3: 문서화 및 릴리스 (0.5일)
```bash
# 1. README 업데이트
# 2. 플러그인 예제 작성 (Aider, Cursor)
# 3. v0.1.3 릴리스
```

---

## 🤔 Devil's Advocate: 3가지 실패 시나리오

### 시나리오 1: 사용자가 플러그인을 추가하지 않음
- **발생 확률**: 중간 (50%)
- **원인**: 기본 3개 프로바이더(Claude, Gemini, Copilot)로 충분
- **대응**: 플러그인을 "실험 기능"으로 마케팅, 필수가 아닌 선택사항으로 포지셔닝

### 시나리오 2: CLI 호환성 문제
- **발생 확률**: 높음 (70%)
- **원인**: 외부 CLI 도구들의 인터페이스가 예상과 다름
  - 일부 CLI는 stdin을 지원하지 않음
  - 출력 포맷이 JSONL이 아닌 경우
  - 에러 메시지 형식이 예측 불가능
- **대응**:
  - 인기 CLI (Aider, Cursor 등) 사전 테스트
  - 플러그인 디버깅 모드 제공 (`--debug-plugin`)
  - 커뮤니티 contributed 플러그인 예제 제공

### 시나리오 3: 유지보수 부담 증가
- **발생 확률**: 낮음 (30%)
- **원인**: 플러그인 관련 버그 리포트 증가
- **대응**:
  - 플러그인은 "커뮤니티 지원" 명시
  - 공식 지원은 내장 3개만
  - 플러그인 문제는 GitHub Discussions로 유도

---

## 📝 구현 우선순위

### 즉시 (v0.1.3)
- ✅ 옵션 1: YAML 기반 동적 로딩 구현

### 나중에 (v0.2.0~v1.0)
- ⏳ 옵션 2: NPM 플러그인 시스템 (커뮤니티 요청 있을 때)
- ⏳ 옵션 3: JavaScript 플러그인 파일 (필요성 낮음, 생략 가능)

---

**질문이나 추가 논의 사항이 있으신가요?**
