# WBS-32: Project Templates System (crewx template)

> **목표**: `crewx template` 서브커맨드 기반 프로젝트 스캐폴딩 시스템으로 마켓플레이스 출시 전까지 개발자들이 CrewX 프로젝트를 쉽게 시작할 수 있도록 지원

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [핵심 전략](#핵심-전략)
3. [아키텍처](#아키텍처)
4. [구현 계획](#구현-계획)
5. [Phase별 상세](#phase별-상세)
6. [기술 스택](#기술-스택)

---

## 프로젝트 개요

### 배경
- **문제**: 마켓플레이스(WBS-31) 완성 전까지 CrewX 프로젝트 시작이 어려움
- **해결**: `crewx template` 서브커맨드로 빈자리 메꾸기 + 개발자 생태계 구축

### 목표
1. **단기**: 마켓플레이스 완성 전까지 프로젝트 템플릿 제공
2. **중기**: 개발자들이 `template → develop → deploy` 워크플로우로 마켓플레이스 기여
3. **장기**: 마켓플레이스와 통합하여 완전한 생태계 구축

### npm create 대신 서브커맨드를 선택한 이유
- ✅ **단일 패키지**: 버전 싱크 문제 없음 (별도 `create-crewx-project` 유지보수 불필요)
- ✅ **CLI UX 일관성**: `crewx` 하나로 모든 작업 (`template`, `install`, `deploy`)
- ✅ **유지보수 편의성**: 템플릿을 `packages/cli/templates/` 안에 포함
- ✅ **확장성**: `crewx template list`, `crewx template show` 등 부가 기능 추가 쉬움
- ✅ **마켓플레이스 연결**: `crewx template` → `crewx install` 자연스러운 전환

---

## 핵심 전략

### 1. 개발자 vs 사용자 구분

```bash
# 🛠️ 개발자용 (Developer Mode)
crewx template init my-wbs-bot --template wbs-automation
# 생성물:
# - crewx.yaml (편집 가능)
# - 소스코드 전부 노출
# - 자유롭게 커스터마이징
# - crewx deploy → 마켓플레이스 배포 가능

# 👤 사용자용 (Consumer Mode) - WBS-31에서 제공
crewx install wbs-automation
# 생성물:
# - 암호화된 패키지
# - 소스코드 숨김 (IP 보호)
# - 수정 불가, 사용만 가능
# - 마켓플레이스에서 다운로드
```

### 2. 생태계 플로우

```
┌─────────────────────────────────────────────────────────────┐
│  개발자 워크플로우                                              │
├─────────────────────────────────────────────────────────────┤
│  1. crewx template init my-bot --template wbs-automation    │
│  2. 커스터마이징 (crewx.yaml, wbs-loop.sh 수정)                │
│  3. 테스트 (./wbs-loop.sh --test)                           │
│  4. crewx deploy → 마켓플레이스 배포                           │
└─────────────────────────────────────────────────────────────┘

                           ⬇️

┌─────────────────────────────────────────────────────────────┐
│  마켓플레이스 (WBS-31)                                         │
├─────────────────────────────────────────────────────────────┤
│  - Agent 목록/상세 페이지                                      │
│  - 검색/필터                                                  │
│  - 다운로드/설치                                              │
└─────────────────────────────────────────────────────────────┘

                           ⬇️

┌─────────────────────────────────────────────────────────────┐
│  사용자 워크플로우                                              │
├─────────────────────────────────────────────────────────────┤
│  1. crewx install wbs-automation                            │
│  2. 즉시 사용 (수정 불가)                                      │
│  3. 업데이트: crewx update wbs-automation                    │
└─────────────────────────────────────────────────────────────┘
```

### 3. 마켓플레이스 빈자리 메꾸기

**현재 상황** (2025-01-17):
- WBS-31 Marketplace: 구현 대기 중 (4일 소요 예상)
- 개발자들이 CrewX로 뭘 만들지 모름

**해결책**:
- `crewx template`로 템플릿 제공
- 개발자들이 템플릿 보고 "아, 이런 걸 만들 수 있구나!" 학습
- 마켓플레이스 완성되면 자연스럽게 `crewx deploy` 전환

---

## 아키텍처

### 패키지 구조 (Monorepo 내부)

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── template/
│   │   │   ├── init.command.ts        # crewx template init
│   │   │   ├── list.command.ts        # crewx template list
│   │   │   ├── show.command.ts        # crewx template show
│   │   │   └── index.ts
│   │   └── ...
│   ├── services/
│   │   └── template.service.ts        # 템플릿 스캐폴딩 로직
│   └── ...
│
└── templates/                          # 템플릿 파일들
    ├── _base/                          # 모든 템플릿 공통
    │   ├── .gitignore
    │   ├── README.md.hbs               # Handlebars 템플릿
    │   └── .env.example
    │
    ├── wbs-automation/
    │   ├── manifest.json               # 템플릿 메타데이터
    │   ├── wbs.md.hbs
    │   ├── wbs-loop.sh
    │   ├── crewx.yaml.hbs
    │   └── wbs/
    │       └── wbs-template.md.hbs
    │
    ├── docusaurus-admin/
    │   ├── manifest.json
    │   ├── content-plan.md.hbs
    │   ├── docs-loop.sh
    │   └── crewx.yaml.hbs
    │
    └── dev-team/
        ├── manifest.json
        ├── sprint-plan.md.hbs
        ├── team-loop.sh
        └── crewx.yaml.hbs
```

### CLI 플로우

```bash
$ crewx template init my-wbs-bot

┌────────────────────────────────────────┐
│  Welcome to CrewX Template System! 🚀  │
└────────────────────────────────────────┘

✨ Creating a new CrewX project...

? Project name: my-wbs-bot
? Description: WBS automation for my AI project
? Select template:
  ❯ wbs-automation     - WBS 자동화 (wbs.md + coordinator)
    docusaurus-admin   - 문서 사이트 관리
    dev-team           - 개발팀 협업
    custom             - 커스텀 워크플로우

? Agent provider:
  ❯ cli/anthropic
    api/openai
    api/anthropic
    api/google

? Enable automation loop? (Y/n) Y
? Loop interval: (1 hour)

✅ Creating project at: ./my-wbs-bot
✅ Initializing git repository...

🎉 Done! Next steps:

  cd my-wbs-bot
  chmod +x wbs-loop.sh
  ./wbs-loop.sh --test

📚 Documentation: https://crewx.dev/docs/templates
🚀 Deploy to marketplace: crewx deploy (coming soon)
```

### 템플릿 메타데이터 (manifest.json)

```json
{
  "name": "wbs-automation",
  "version": "1.0.0",
  "displayName": "WBS Automation",
  "description": "WBS 자동화 프로젝트 템플릿 (wbs.md + coordinator)",
  "category": "automation",
  "tags": ["wbs", "automation", "project-management"],
  "author": "CrewX Team",
  "minimumCrewxVersion": "0.3.0",
  "variables": [
    {
      "name": "projectName",
      "type": "string",
      "description": "프로젝트 이름",
      "required": true
    },
    {
      "name": "description",
      "type": "string",
      "description": "프로젝트 설명",
      "default": "WBS automation project"
    },
    {
      "name": "provider",
      "type": "select",
      "description": "AI Provider",
      "choices": ["cli/anthropic", "api/openai", "api/anthropic", "api/google"],
      "default": "cli/anthropic"
    },
    {
      "name": "enableLoop",
      "type": "boolean",
      "description": "자동 루프 활성화",
      "default": true
    },
    {
      "name": "loopInterval",
      "type": "number",
      "description": "루프 간격 (시간)",
      "default": 1,
      "when": "enableLoop === true"
    }
  ]
}
```

---

## 구현 계획

### 일정: 3-4일

| Day | Phase | 작업 | 소요 | 산출물 |
|-----|-------|------|------|--------|
| 1 | Phase 1 | CLI 명령어 구조 | 8시간 | `template` 서브커맨드 |
| 2 | Phase 2 | WBS Automation 템플릿 | 8시간 | wbs-automation 완성 |
| 3 | Phase 3 | 추가 템플릿 | 8시간 | docusaurus, dev-team |
| 4 | Phase 4 | 테스트 & 문서화 | 8시간 | E2E 테스트, 문서 |

---

## Phase별 상세

### Phase 1: CLI 명령어 구조 (Day 1, 8시간)

#### 1.1 template 서브커맨드 등록 (2시간)

**packages/cli/src/commands/template/index.ts**:
```typescript
import { Command } from 'commander';
import { initCommand } from './init.command';
import { listCommand } from './list.command';
import { showCommand } from './show.command';

export function templateCommand(): Command {
  const template = new Command('template')
    .description('Manage CrewX project templates')
    .addCommand(initCommand())
    .addCommand(listCommand())
    .addCommand(showCommand());

  return template;
}
```

**packages/cli/src/cli.ts 수정**:
```typescript
import { templateCommand } from './commands/template';

// ...

program.addCommand(templateCommand());
```

#### 1.2 template init 명령어 (3시간)

**packages/cli/src/commands/template/init.command.ts**:
```typescript
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { TemplateService } from '../../services/template.service';
import { inject, injectable } from 'tsyringe';

export function initCommand(): Command {
  const init = new Command('init')
    .description('Initialize a new CrewX project from template')
    .argument('[project-name]', 'Project directory name')
    .option('-t, --template <name>', 'Template name (wbs-automation, docusaurus-admin, dev-team)')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(async (projectName, options) => {
      console.log(chalk.cyan('✨ Creating a new CrewX project...\n'));

      const templateService = new TemplateService();

      // 1. 템플릿 목록 로드
      const templates = await templateService.listTemplates();

      // 2. 인터랙티브 프롬프트
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: projectName || 'my-crewx-project',
          when: !projectName,
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: 'A CrewX automation project',
        },
        {
          type: 'list',
          name: 'template',
          message: 'Select template:',
          choices: templates.map(t => ({
            name: `${t.displayName} - ${t.description}`,
            value: t.name,
          })),
          when: !options.template,
        },
        {
          type: 'list',
          name: 'provider',
          message: 'Agent provider:',
          choices: [
            'cli/anthropic',
            'api/openai',
            'api/anthropic',
            'api/google',
          ],
          default: 'cli/anthropic',
        },
        {
          type: 'confirm',
          name: 'enableLoop',
          message: 'Enable automation loop?',
          default: true,
        },
        {
          type: 'input',
          name: 'loopInterval',
          message: 'Loop interval (in hours):',
          default: '1',
          when: (answers) => answers.enableLoop,
        },
      ]);

      const config = {
        projectName: answers.projectName || projectName,
        description: answers.description,
        template: options.template || answers.template,
        provider: answers.provider,
        enableLoop: answers.enableLoop,
        loopInterval: answers.loopInterval ? parseInt(answers.loopInterval) * 3600 : 3600,
      };

      // 3. 스캐폴딩 실행
      await templateService.scaffoldProject(config);

      console.log(chalk.green('\n✅ Done! Next steps:\n'));
      console.log(chalk.cyan(`  cd ${config.projectName}`));
      console.log(chalk.cyan(`  chmod +x *-loop.sh`));
      console.log(chalk.cyan(`  ./*-loop.sh --test`));
      console.log(chalk.gray('\n📚 Documentation: https://crewx.dev/docs/templates'));
    });

  return init;
}
```

#### 1.3 TemplateService 구현 (3시간)

**packages/cli/src/services/template.service.ts**:
```typescript
import path from 'path';
import fs from 'fs-extra';
import Handlebars from 'handlebars';
import chalk from 'chalk';

interface TemplateManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  minimumCrewxVersion: string;
  variables: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
    default?: any;
  }>;
}

interface ScaffoldConfig {
  projectName: string;
  description: string;
  template: string;
  provider: string;
  enableLoop: boolean;
  loopInterval: number;
}

export class TemplateService {
  private templatesDir: string;

  constructor() {
    // packages/cli/templates/
    this.templatesDir = path.join(__dirname, '../../templates');
  }

  /**
   * 사용 가능한 템플릿 목록 조회
   */
  async listTemplates(): Promise<TemplateManifest[]> {
    const dirs = await fs.readdir(this.templatesDir);
    const templates: TemplateManifest[] = [];

    for (const dir of dirs) {
      if (dir.startsWith('_')) continue; // _base 등 내부 템플릿 제외

      const manifestPath = path.join(this.templatesDir, dir, 'manifest.json');
      if (await fs.pathExists(manifestPath)) {
        const manifest = await fs.readJson(manifestPath);
        templates.push(manifest);
      }
    }

    return templates;
  }

  /**
   * 특정 템플릿 정보 조회
   */
  async getTemplate(name: string): Promise<TemplateManifest | null> {
    const manifestPath = path.join(this.templatesDir, name, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }
    return fs.readJson(manifestPath);
  }

  /**
   * 프로젝트 스캐폴딩
   */
  async scaffoldProject(config: ScaffoldConfig): Promise<void> {
    const targetDir = path.join(process.cwd(), config.projectName);

    // 1. 디렉토리 생성
    console.log(chalk.blue(`✅ Creating directory: ${targetDir}`));
    await fs.ensureDir(targetDir);

    // 2. Base 템플릿 복사
    console.log(chalk.blue('✅ Copying base template...'));
    await this.copyTemplate('_base', targetDir, config);

    // 3. 선택된 템플릿 복사
    console.log(chalk.blue(`✅ Copying ${config.template} template...`));
    await this.copyTemplate(config.template, targetDir, config);

    // 4. package.json 생성
    console.log(chalk.blue('✅ Creating package.json...'));
    await this.createPackageJson(targetDir, config);

    // 5. Git 초기화
    console.log(chalk.blue('✅ Initializing git repository...'));
    await this.initGit(targetDir);

    // 6. 실행 권한 부여
    console.log(chalk.blue('✅ Setting permissions...'));
    await this.setExecutable(targetDir);
  }

  /**
   * 템플릿 파일 복사 (Handlebars 렌더링 지원)
   */
  private async copyTemplate(
    templateName: string,
    targetDir: string,
    config: ScaffoldConfig
  ): Promise<void> {
    const templateDir = path.join(this.templatesDir, templateName);

    if (!(await fs.pathExists(templateDir))) {
      throw new Error(`Template not found: ${templateName}`);
    }

    await this.copyRecursive(templateDir, targetDir, config);
  }

  /**
   * 재귀적 파일 복사 (Handlebars 처리)
   */
  private async copyRecursive(
    srcDir: string,
    destDir: string,
    config: ScaffoldConfig
  ): Promise<void> {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);

      // manifest.json은 복사 제외
      if (entry.name === 'manifest.json') continue;

      let destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        await fs.ensureDir(destPath);
        await this.copyRecursive(srcPath, destPath, config);
      } else if (entry.name.endsWith('.hbs')) {
        // Handlebars 템플릿 렌더링
        destPath = destPath.replace('.hbs', '');
        const template = await fs.readFile(srcPath, 'utf-8');
        const compiled = Handlebars.compile(template);
        const rendered = compiled(config);
        await fs.writeFile(destPath, rendered);
      } else {
        // 일반 파일 복사
        await fs.copy(srcPath, destPath);
      }
    }
  }

  /**
   * package.json 생성
   */
  private async createPackageJson(targetDir: string, config: ScaffoldConfig): Promise<void> {
    const packageJson = {
      name: config.projectName,
      version: '0.1.0',
      description: config.description,
      private: true,
      scripts: {
        start: './wbs-loop.sh',
        test: './wbs-loop.sh --test',
      },
    };

    await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 });
  }

  /**
   * Git 저장소 초기화
   */
  private async initGit(targetDir: string): Promise<void> {
    const { execSync } = await import('child_process');
    try {
      execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Git initialization failed (git may not be installed)'));
    }
  }

  /**
   * Shell 스크립트 실행 권한 부여
   */
  private async setExecutable(targetDir: string): Promise<void> {
    const files = await fs.readdir(targetDir);
    for (const file of files) {
      if (file.endsWith('.sh')) {
        await fs.chmod(path.join(targetDir, file), 0o755);
      }
    }
  }
}
```

---

### Phase 2: WBS Automation 템플릿 (Day 2, 8시간)

#### 2.1 manifest.json (1시간)

**packages/cli/templates/wbs-automation/manifest.json**:
```json
{
  "name": "wbs-automation",
  "version": "1.0.0",
  "displayName": "WBS Automation",
  "description": "WBS 자동화 프로젝트 템플릿 (wbs.md + coordinator)",
  "category": "automation",
  "tags": ["wbs", "automation", "project-management"],
  "author": "CrewX Team",
  "minimumCrewxVersion": "0.3.0",
  "variables": [
    {
      "name": "projectName",
      "type": "string",
      "description": "프로젝트 이름",
      "required": true
    },
    {
      "name": "description",
      "type": "string",
      "description": "프로젝트 설명",
      "default": "WBS automation project"
    },
    {
      "name": "provider",
      "type": "select",
      "description": "AI Provider",
      "choices": ["cli/anthropic", "api/openai", "api/anthropic", "api/google"],
      "default": "cli/anthropic"
    },
    {
      "name": "enableLoop",
      "type": "boolean",
      "description": "자동 루프 활성화",
      "default": true
    },
    {
      "name": "loopInterval",
      "type": "number",
      "description": "루프 간격 (시간)",
      "default": 1
    }
  ]
}
```

#### 2.2 wbs.md 템플릿 (2시간)

**packages/cli/templates/wbs-automation/wbs.md.hbs**:
```markdown
# {{projectName}} WBS

> 상태: `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `🔄 보류`

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [진행 현황](#진행-현황)

---

## 프로젝트 개요

**목표**: {{description}}

**기술 스택**: CrewX, {{provider}}

**총 소요**: TBD

---

## 진행 현황

| 상태 | ID | 작업명 | 산출물 | 소요 | 우선순위 |
|------|----|--------------------|--------|------|---------|
| ⬜️  | WBS-1 | 프로젝트 셋업 | 기본 구조 | 1일 | P0 |
| ⬜️  | WBS-2 | 기능 A 구현 | ... | 2일 | P0 |
| ⬜️  | WBS-3 | 기능 B 구현 | ... | 2일 | P1 |

---

## WBS-1: 프로젝트 셋업 (⬜️ 대기)

**목표**: 기본 프로젝트 구조 설정

**산출물**:
- 프로젝트 디렉토리 구조
- 기본 설정 파일
- 초기 문서화

---

## 참고 문서

### WBS 상세 계획
- [WBS-1: 프로젝트 셋업](wbs/wbs-1-setup.md)
```

#### 2.3 wbs-loop.sh (2시간)

**packages/cli/templates/wbs-automation/wbs-loop.sh**:
```bash
#!/bin/bash
# ============================================================
# {{projectName}} WBS 자동화 루프
# ============================================================

set -e
set -o pipefail

CREWX_CMD="${CREWX_CMD:-crewx}"
MAX_LOOPS=${MAX_LOOPS:-24}
SLEEP_TIME=${SLEEP_TIME:-{{loopInterval}}}

# Context Thread
DAY_THREAD="wbs-$(date +%Y%m%d)"
CONTEXT_THREAD="$DAY_THREAD-context"
export CONTEXT_THREAD

CONFIG_FILE="crewx.yaml"
COORDINATOR_TIMEOUT="1800000"

# 테스트 모드
if [[ "$1" == "--test" ]]; then
  MAX_LOOPS=3
  SLEEP_TIME=300  # 5분
  echo "🧪 Test mode: MAX_LOOPS=$MAX_LOOPS, SLEEP_TIME=$SLEEP_TIME"
fi

echo "🚀 Starting WBS Automation Loop"
echo "   Config: $CONFIG_FILE"
echo "   Thread: $CONTEXT_THREAD"
echo "   Loops: $MAX_LOOPS"
echo "   Interval: $SLEEP_TIME seconds"
echo ""

for i in $(seq 1 $MAX_LOOPS); do
  echo "========================================"
  echo "Loop #$i / $MAX_LOOPS"
  echo "========================================"

  $CREWX_CMD execute \
    --config "$CONFIG_FILE" \
    --thread "$CONTEXT_THREAD" \
    --timeout "$COORDINATOR_TIMEOUT" \
    "@coordinator wbs.md를 읽고 다음 Phase를 진행하세요"

  if [ $i -lt $MAX_LOOPS ]; then
    echo "😴 Sleeping for $SLEEP_TIME seconds..."
    sleep $SLEEP_TIME
  fi
done

echo "✅ WBS Automation Loop completed ($MAX_LOOPS loops)"
```

#### 2.4 crewx.yaml (2시간)

**packages/cli/templates/wbs-automation/crewx.yaml.hbs**:
```yaml
agents:
  - name: coordinator
    provider: {{provider}}
    description: WBS Coordinator - 자동 Phase 진행 관리
    system_prompt: |
      당신은 {{projectName}}의 WBS Coordinator입니다.

      역할:
      - wbs.md 읽고 미완료 Phase 확인
      - 병렬 실행 가능한 Phase 선택
      - 개발 에이전트 호출
      - 완료 후 wbs.md 업데이트

      작업 플로우:
      1. wbs.md 확인
      2. 다음 Phase 선택
      3. @developer 호출
      4. 결과 확인 및 wbs.md 업데이트

  - name: developer
    provider: {{provider}}
    description: 실제 개발 작업 수행
    system_prompt: |
      당신은 개발자입니다.
      Coordinator가 지시한 Phase를 구현하세요.

{{#if enableLoop}}
env:
  CONTEXT_THREAD: "{{CONTEXT_THREAD}}"
{{/if}}
```

#### 2.5 README 템플릿 (1시간)

**packages/cli/templates/wbs-automation/README.md.hbs**:
```markdown
# {{projectName}}

{{description}}

## 🚀 Quick Start

1. **테스트 실행** (5분 간격, 3회):
   ```bash
   ./wbs-loop.sh --test
   ```

2. **프로덕션 실행** ({{loopInterval}}초 간격, 24회):
   ```bash
   ./wbs-loop.sh
   ```

## 📁 Project Structure

```
{{projectName}}/
├── wbs.md               # WBS 계획 문서
├── wbs-loop.sh          # 자동화 루프 스크립트
├── crewx.yaml           # Agent 설정
├── wbs/                 # Phase 상세 문서
│   └── wbs-1-*.md
└── README.md
```

## 🤖 Agents

- **@coordinator**: WBS 진행 관리
- **@developer**: 실제 개발 작업

## 📚 Documentation

- [CrewX Docs](https://crewx.dev/docs)
- [WBS Template Guide](https://crewx.dev/docs/templates/wbs-automation)

## 🚀 Deploy to Marketplace

```bash
crewx deploy
```

(마켓플레이스 출시 후 사용 가능)
```

---

### Phase 3: 추가 템플릿 (Day 3, 8시간)

#### 3.1 template list 명령어 (2시간)

**packages/cli/src/commands/template/list.command.ts**:
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { TemplateService } from '../../services/template.service';

export function listCommand(): Command {
  const list = new Command('list')
    .alias('ls')
    .description('List available templates')
    .action(async () => {
      const templateService = new TemplateService();
      const templates = await templateService.listTemplates();

      console.log(chalk.cyan.bold('\n📦 Available Templates:\n'));

      templates.forEach((t) => {
        console.log(chalk.yellow(`  ${t.name}`) + chalk.gray(` (v${t.version})`));
        console.log(chalk.white(`    ${t.description}`));
        console.log(chalk.gray(`    Category: ${t.category}`));
        console.log(chalk.gray(`    Tags: ${t.tags.join(', ')}`));
        console.log('');
      });

      console.log(chalk.gray('💡 Use ') + chalk.cyan('crewx template init <name> --template <template-name>') + chalk.gray(' to create a project'));
    });

  return list;
}
```

#### 3.2 template show 명령어 (2시간)

**packages/cli/src/commands/template/show.command.ts**:
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { TemplateService } from '../../services/template.service';

export function showCommand(): Command {
  const show = new Command('show')
    .description('Show template details')
    .argument('<template-name>', 'Template name to show')
    .action(async (templateName) => {
      const templateService = new TemplateService();
      const template = await templateService.getTemplate(templateName);

      if (!template) {
        console.error(chalk.red(`❌ Template not found: ${templateName}`));
        process.exit(1);
      }

      console.log(chalk.cyan.bold(`\n📦 ${template.displayName}`));
      console.log(chalk.gray(`Version: ${template.version}`));
      console.log('');
      console.log(chalk.white(template.description));
      console.log('');
      console.log(chalk.gray(`Category: ${template.category}`));
      console.log(chalk.gray(`Tags: ${template.tags.join(', ')}`));
      console.log(chalk.gray(`Author: ${template.author}`));
      console.log(chalk.gray(`Minimum CrewX: ${template.minimumCrewxVersion}`));
      console.log('');

      if (template.variables.length > 0) {
        console.log(chalk.cyan.bold('Variables:'));
        template.variables.forEach((v) => {
          const required = v.required ? chalk.red(' (required)') : '';
          const defaultValue = v.default ? chalk.gray(` [default: ${v.default}]`) : '';
          console.log(`  ${chalk.yellow(v.name)}${required}: ${v.description}${defaultValue}`);
        });
        console.log('');
      }

      console.log(chalk.gray('💡 Use ') + chalk.cyan(`crewx template init my-project --template ${templateName}`) + chalk.gray(' to create'));
    });

  return show;
}
```

#### 3.3 Docusaurus Admin 템플릿 (2시간)

**packages/cli/templates/docusaurus-admin/manifest.json**:
```json
{
  "name": "docusaurus-admin",
  "version": "1.0.0",
  "displayName": "Docusaurus Admin",
  "description": "Docusaurus 문서 사이트 자동 관리 템플릿",
  "category": "documentation",
  "tags": ["docusaurus", "documentation", "content"],
  "author": "CrewX Team",
  "minimumCrewxVersion": "0.3.0"
}
```

**packages/cli/templates/docusaurus-admin/crewx.yaml.hbs**:
```yaml
agents:
  - name: content_planner
    provider: {{provider}}
    description: 콘텐츠 계획 수립

  - name: writer
    provider: {{provider}}
    description: 문서 작성

  - name: reviewer
    provider: {{provider}}
    description: 리뷰 및 퇴고
```

#### 3.4 Dev Team 템플릿 (2시간)

**packages/cli/templates/dev-team/manifest.json**:
```json
{
  "name": "dev-team",
  "version": "1.0.0",
  "displayName": "Dev Team Collaboration",
  "description": "개발팀 협업 자동화 템플릿 (Sprint 관리)",
  "category": "collaboration",
  "tags": ["sprint", "scrum", "team"],
  "author": "CrewX Team",
  "minimumCrewxVersion": "0.3.0"
}
```

---

### Phase 4: 테스트 & 문서화 (Day 4, 8시간)

#### 4.1 단위 테스트 (3시간)

**packages/cli/tests/services/template.service.spec.ts**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateService } from '../../src/services/template.service';
import fs from 'fs-extra';
import path from 'path';

describe('TemplateService', () => {
  let service: TemplateService;
  const testDir = path.join(__dirname, 'fixtures', 'test-project');

  beforeEach(() => {
    service = new TemplateService();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('listTemplates', () => {
    it('should return available templates', async () => {
      const templates = await service.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('displayName');
    });
  });

  describe('getTemplate', () => {
    it('should return template manifest', async () => {
      const template = await service.getTemplate('wbs-automation');
      expect(template).not.toBeNull();
      expect(template?.name).toBe('wbs-automation');
    });

    it('should return null for non-existent template', async () => {
      const template = await service.getTemplate('non-existent');
      expect(template).toBeNull();
    });
  });

  describe('scaffoldProject', () => {
    it('should create wbs-automation template', async () => {
      const config = {
        projectName: path.basename(testDir),
        description: 'Test project',
        template: 'wbs-automation',
        provider: 'cli/anthropic',
        enableLoop: true,
        loopInterval: 3600,
      };

      await service.scaffoldProject({
        ...config,
        projectName: testDir,
      });

      expect(await fs.pathExists(path.join(testDir, 'wbs.md'))).toBe(true);
      expect(await fs.pathExists(path.join(testDir, 'wbs-loop.sh'))).toBe(true);
      expect(await fs.pathExists(path.join(testDir, 'crewx.yaml'))).toBe(true);
      expect(await fs.pathExists(path.join(testDir, 'package.json'))).toBe(true);

      // Handlebars 렌더링 확인
      const wbsContent = await fs.readFile(path.join(testDir, 'wbs.md'), 'utf-8');
      expect(wbsContent).toContain(path.basename(testDir));
      expect(wbsContent).toContain('Test project');
    });
  });
});
```

#### 4.2 통합 테스트 (2시간)

**packages/cli/tests/commands/template.e2e.spec.ts**:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

describe('template command E2E', () => {
  const testProject = path.join(__dirname, 'fixtures', 'e2e-project');

  afterEach(async () => {
    await fs.remove(testProject);
  });

  it('should create project with template list command', () => {
    const output = execSync('npm run crewx -- template list', {
      encoding: 'utf-8',
    });

    expect(output).toContain('wbs-automation');
    expect(output).toContain('docusaurus-admin');
    expect(output).toContain('dev-team');
  });

  it('should show template details', () => {
    const output = execSync('npm run crewx -- template show wbs-automation', {
      encoding: 'utf-8',
    });

    expect(output).toContain('WBS Automation');
    expect(output).toContain('WBS 자동화');
  });

  it('should initialize project from template', () => {
    execSync(
      `npm run crewx -- template init ${path.basename(testProject)} --template wbs-automation -y`,
      {
        cwd: path.dirname(testProject),
      }
    );

    expect(fs.existsSync(path.join(testProject, 'wbs.md'))).toBe(true);
    expect(fs.existsSync(path.join(testProject, 'wbs-loop.sh'))).toBe(true);

    // 실행 권한 확인
    const stats = fs.statSync(path.join(testProject, 'wbs-loop.sh'));
    expect(stats.mode & 0o111).toBeTruthy(); // 실행 권한 있음
  });
});
```

#### 4.3 문서화 (3시간)

**docs/templates/overview.md**:
```markdown
# CrewX Templates

CrewX Template System을 사용하면 미리 구성된 프로젝트 템플릿에서 새 프로젝트를 빠르게 시작할 수 있습니다.

## Quick Start

```bash
# 템플릿 목록 확인
crewx template list

# 템플릿 상세 보기
crewx template show wbs-automation

# 새 프로젝트 생성
crewx template init my-project
```

## 사용 가능한 템플릿

### WBS Automation
WBS 문서 기반 자동화 프로젝트 템플릿

### Docusaurus Admin
Docusaurus 문서 사이트 자동 관리

### Dev Team Collaboration
개발팀 Sprint 관리 자동화

## 커스텀 템플릿 만들기

[Custom Templates Guide](./custom-templates.md) 참고
```

---

## 기술 스택

### Dependencies
- **commander**: CLI 파싱 (이미 사용 중)
- **inquirer**: 인터랙티브 프롬프트
- **chalk**: 색상 출력 (이미 사용 중)
- **handlebars**: 템플릿 렌더링
- **fs-extra**: 파일 복사 (이미 사용 중)

### 추가 패키지 설치 필요
```bash
cd packages/cli
npm install inquirer handlebars
npm install -D @types/inquirer @types/handlebars
```

---

## 통합 포인트

### 1. crewx deploy (미래 - WBS-31 완성 후)

```bash
cd my-wbs-bot
crewx deploy
# → 마켓플레이스에 배포
# → 암호화 + 라이선스 적용
# → crewx install로 다운로드 가능
```

### 2. crewx install (마켓플레이스)

**사용자 경험**:
```bash
crewx install wbs-automation
# → 암호화된 패키지 다운로드
# → 수정 불가, 사용만 가능
# → 자동 업데이트 지원
```

### 3. 일관된 CLI UX

```bash
# 모두 crewx 명령어로 통일
crewx template init    # 개발자: 프로젝트 생성
crewx deploy           # 개발자: 마켓플레이스 배포
crewx install          # 사용자: 마켓플레이스에서 설치
crewx update           # 사용자: 업데이트
```

---

## 성공 기준

### Phase 1
- ✅ `crewx template` 서브커맨드 등록
- ✅ `crewx template init` 동작
- ✅ `crewx template list/show` 동작
- ✅ TemplateService 구현

### Phase 2
- ✅ WBS 템플릿 완성
- ✅ wbs-loop.sh 실행 가능
- ✅ Handlebars 렌더링 동작

### Phase 3
- ✅ Docusaurus 템플릿 완성
- ✅ Dev Team 템플릿 완성
- ✅ 3개 템플릿 모두 테스트 통과

### Phase 4
- ✅ 단위 테스트 통과
- ✅ E2E 테스트 통과
- ✅ 문서화 완료

---

## 다음 단계

1. **WBS-32 승인** → Phase 1 착수
2. **개발자 에이전트 위임** → 4일 자동 구현
3. **사용자 피드백** → 템플릿 개선
4. **WBS-31 연동** → `crewx deploy` 통합

---

## 참고 문서

- [Commander.js 문서](https://github.com/tj/commander.js)
- [Inquirer.js 문서](https://github.com/SBoudrias/Inquirer.js)
- [Handlebars 문서](https://handlebarsjs.com/)
- [Git CLI 참고](https://git-scm.com/book/en/v2/Getting-Started-The-Command-Line)
