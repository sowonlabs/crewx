import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class HelpService {
  private getPackageInfo() {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = readFileSync(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      return {
        version: packageJson.version || '0.1.1',
        repository: packageJson.repository?.url || 'https://github.com/sowonlabs/crewx'
      };
    } catch (error) {
      return {
        version: '0.1.1',
        repository: 'https://github.com/sowonlabs/crewx'
      };
    }
  }

  showHelp() {
    const { version, repository } = this.getPackageInfo();
    
    console.log(chalk.bold.cyan(`
  CrewX CLI v${version} - AI-Powered Development Team at Your Fingertips
`));
    console.log(chalk.bold('========================================================='));
    console.log(chalk.yellow(`
Welcome to CrewX!

CrewX is a multi-AI agent collaboration platform designed to streamline your
development workflow. You can assign tasks to different AI agents, each with
their own specialization, and get results in parallel.
`));

    console.log(chalk.bold.white('USAGE:'));
    console.log(chalk.white(`  $ crewx <command> [options] "[prompt] [@agent1 @agent2 ...]"
`));

    console.log(chalk.bold.white('COMMANDS:'));

    this.showCommandHelp(
      'query, q',
      'Ask a question or assign a high-level task. Ideal for analysis, design, and complex problem-solving.',
      [
        'crewx query "@claude Analyze our authentication flow for potential security vulnerabilities."',
        'crewx q "@claude:opus Design a database schema for a simple e-commerce site."',
        'crewx q "@copilot What are the best practices for building a scalable REST API in Node.js?"',
      ],
    );

    this.showCommandHelp(
      'execute, x',
      'Give a direct order to write or modify code. Best for implementation-focused tasks.',
      [
        'crewx execute "@gemini Implement a function that calculates the factorial of a number in TypeScript."',
        'crewx x "@copilot:gpt-5 Refactor the \'userService.ts\' file to use async/await instead of promises."',
        'crewx x "@copilot Create a new React component called \'UserProfile\' with a form to update user details."',
      ],
    );

    this.showCommandHelp(
      'init',
      'Initializes a new CrewX project, creating a default `crewx.yaml` configuration file.',
      ['crewx init'],
    );

    this.showCommandHelp(
      'doctor',
      'Checks the health and status of your configured AI providers (e.g., Gemini, Claude, Copilot).',
      ['crewx doctor'],
    );

    this.showCommandHelp(
      'mcp',
      'Starts the Model Context Protocol (MCP) server for integration with IDEs like VS Code.',
      ['crewx mcp'],
    );

    this.showCommandHelp(
      'chat',
      'Start an interactive chat session with conversation history. Maintains context across messages.',
      [
        'crewx chat',
        'crewx chat --thread my-session',
        'crewx chat --list',
        'crewx chat --delete my-session',
      ],
    );

    this.showCommandHelp(
      'agent',
      'Inspect available agents and their metadata.',
      [
        'crewx agent',
        'crewx agent ls',
        'crewx agent ls --raw',
      ],
    );

    this.showCommandHelp(
      'log',
      'View task execution logs and debugging information.',
      [
        'crewx log',
        'crewx log ls',
        'crewx log task_1234567890_abcdef',
      ],
    );

    this.showCommandHelp(
      'slack',
      'Starts the Slack bot integration for team collaboration. Supports read-only query and execute modes.',
      [
        'crewx slack',
        'crewx slack --mode execute',
        'crewx slack --agent gemini',
        'crewx slack --agent copilot',
        'crewx slack --mention-only  # Require @mention (prevents auto-responses)'
      ],
    );

    this.showCommandHelp('help', 'Shows this help message.', ['crewx help']);

    console.log(chalk.bold.white('\nAGENT SPECIALIZATIONS:'));
    console.log(chalk.white(`
  You can direct tasks to agents by mentioning them with '@'. Each agent has a
  unique strength:

  - ${chalk.bold('@claude')} : Excels at complex reasoning, system design, and architectural decisions.
  - ${chalk.bold('@copilot')} : Your go-to for implementation, best practices, and generating code.
  - ${chalk.bold('@gemini')} : Specialized in performance analysis, data structures, and algorithms.

  You can query multiple agents at once for a collaborative effort:
  ${chalk.gray('$ crewx query "@claude @gemini Review this code for bugs and suggest performance improvements"')}
`));

    console.log(chalk.bold.white('\nOPTIONS:'));
    console.log(chalk.white(`  -c, --config <file>    Path to the agent configuration file (default: "crewx.yaml")`));
    console.log(chalk.white(`  --log                  Enable detailed logging for debugging.`));
    console.log(chalk.white(`  -h, --help             Show this help message.`));

    console.log(chalk.bold.cyan(`
For more information, visit: ${repository}`));
  }

  private showCommandHelp(name: string, description: string, examples: string[]) {
    console.log(chalk.bold.green(`
  ${name}`));
    console.log(chalk.white(`    ${description}`));
    if (examples.length > 0) {
      console.log(chalk.gray('    Examples:'));
      examples.forEach(example => {
        console.log(chalk.gray(`      $ ${example}`));
      });
    }
  }
}
