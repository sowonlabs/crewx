import { describe, it, expect, beforeEach } from 'vitest';
import chalk from 'chalk';
import { TerminalMessageFormatter } from '../../../src/utils/terminal-message-formatter';
import { StructuredMessage } from '@sowonai/crewx-sdk';

describe('TerminalMessageFormatter', () => {
  const now = new Date('2025-10-17T10:00:00.000Z').getTime();
  let formatter: TerminalMessageFormatter;

  beforeEach(() => {
    formatter = new TerminalMessageFormatter({
      colorize: false,
      indent: 2,
      nowProvider: () => now,
      showAbsoluteTime: true,
      showRelativeTime: true,
    });
  });

  it('formats messages with absolute and relative timestamps', () => {
    const message: StructuredMessage = {
      id: '1',
      text: 'First line\nSecond line',
      isAssistant: false,
      timestamp: '2025-10-17T09:58:00.000Z',
      userId: 'developer',
    };

    const output = formatter.formatMessage(message);

    expect(output).toContain('[2025-10-17 09:58Z]');
    expect(output).toContain('developer');
    expect(output).toContain('2 minutes ago');
    const lines = output.split('\n');
    expect(lines[1].startsWith('  ')).toBe(true);
    expect(lines[2].startsWith('  ')).toBe(true);
  });

  it('respects colorize flag when enabled', () => {
    const colorFormatter = new TerminalMessageFormatter({
      colorize: true,
      nowProvider: () => now,
    });

    const message: StructuredMessage = {
      id: '2',
      text: 'Color test',
      isAssistant: true,
      timestamp: '2025-10-17T09:55:00.000Z',
      userId: 'assistant',
    };

    const previousLevel = chalk.level;
    chalk.level = 1;
    const output = colorFormatter.formatMessage(message);
    chalk.level = previousLevel;
    expect(/\u001b\[/g.test(output)).toBe(true);
  });

  it('formats history with spacing between messages', () => {
    const messages: StructuredMessage[] = [
      {
        id: '1',
        text: 'Hello',
        isAssistant: false,
        timestamp: '2025-10-17T09:58:00.000Z',
        userId: 'dev',
      },
      {
        id: '2',
        text: 'Hi there',
        isAssistant: true,
        timestamp: '2025-10-17T09:59:00.000Z',
        userId: 'assistant',
      },
    ];

    const output = formatter.formatHistory(messages);
    const segments = output.split('\n\n');
    expect(segments).toHaveLength(2);
  });
});
