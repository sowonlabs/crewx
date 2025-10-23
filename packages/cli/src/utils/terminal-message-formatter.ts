import chalk from 'chalk';
import {
  BaseMessageFormatter,
  StructuredMessage,
  FormatterOptions,
} from '@sowonai/crewx-sdk';

export interface TerminalFormatterConfig {
  locale?: string;
  indent?: number;
  colorize?: boolean;
  showAbsoluteTime?: boolean;
  showRelativeTime?: boolean;
  nowProvider?: () => number;
}

interface TerminalFormatterOptions extends FormatterOptions {
  locale?: string;
  indent?: number;
  colorize?: boolean;
  showAbsoluteTime?: boolean;
  showRelativeTime?: boolean;
}

export class TerminalMessageFormatter extends BaseMessageFormatter {
  private readonly config: TerminalFormatterConfig;
  private readonly nowProvider: () => number;

  constructor(config: TerminalFormatterConfig = {}) {
    super();
    this.config = config;
    this.nowProvider = config.nowProvider ?? (() => Date.now());
  }

  override formatMessage(
    msg: StructuredMessage,
    options?: FormatterOptions,
  ): string {
    if (!msg || !msg.text) {
      return '';
    }

    const merged = this.mergeOptions(options);
    const indent = merged.indent ?? 2;
    const colorize = merged.colorize !== false;
    const timestamp = this.parseTimestamp(msg.timestamp);
    const locale = merged.locale || this.detectLocale();

    const headerParts: string[] = [];

    if (timestamp && merged.showAbsoluteTime !== false) {
      const formatted = this.formatAbsoluteTime(timestamp);
      headerParts.push(this.applyColor(`[${formatted}]`, 'timestamp', colorize));
    }

    const roleLabel = this.buildRoleLabel(msg, colorize);
    headerParts.push(roleLabel);

    if (timestamp && merged.showRelativeTime !== false) {
      const relative = this.formatRelativeTime(timestamp, locale);
      if (relative) {
        headerParts.push(this.applyColor(`· ${relative}`, 'meta', colorize));
      }
    }

    const header = headerParts.join(' ');
    const body = this.indentText(
      this.sanitizeText(msg.text, merged.maxLength),
      indent,
      colorize,
      msg.isAssistant,
    );

    return `${header}\n${body}`;
  }

  private mergeOptions(options?: FormatterOptions): TerminalFormatterOptions {
    const extended = options as TerminalFormatterOptions | undefined;
    return {
      platform: 'cli',
      includeUserId: true,
      includeTimestamp: false,
      colorize: this.config.colorize ?? true,
      showAbsoluteTime: this.config.showAbsoluteTime ?? true,
      showRelativeTime: this.config.showRelativeTime ?? true,
      indent: this.config.indent ?? 2,
      locale: this.config.locale,
      ...extended,
    };
  }

  private buildRoleLabel(msg: StructuredMessage, colorize: boolean): string {
    const displayName =
      this.resolveDisplayName(msg) ||
      (msg.metadata as any)?.agent_id ||
      msg.userId ||
      (msg.isAssistant ? 'CrewX' : 'User');

    const label = msg.isAssistant
      ? `🤖 ${displayName}`
      : `🧑 ${displayName}`;

    return msg.isAssistant
      ? this.applyColor(label, 'assistant', colorize)
      : this.applyColor(label, 'user', colorize);
  }

  private indentText(
    text: string,
    indent: number,
    colorize: boolean,
    isAssistant: boolean,
  ): string {
    const indentStr = ' '.repeat(Math.max(indent, 0));
    const lines = (text || '').split('\n');
    const indented = lines
      .map(line => `${indentStr}${line}`)
      .join('\n');

    return this.applyColor(indented, isAssistant ? 'assistantBody' : 'userBody', colorize);
  }

  private parseTimestamp(timestamp?: Date | string): Date | null {
    if (!timestamp) {
      return null;
    }

    const value = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return isNaN(value.getTime()) ? null : value;
  }

  private formatAbsoluteTime(date: Date): string {
    const iso = date.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`;
  }

  private formatRelativeTime(date: Date, locale: string): string {
    const diffMs = date.getTime() - this.nowProvider();
    const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
      { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
      { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
      { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
      { unit: 'day', ms: 1000 * 60 * 60 * 24 },
      { unit: 'hour', ms: 1000 * 60 * 60 },
      { unit: 'minute', ms: 1000 * 60 },
      { unit: 'second', ms: 1000 },
    ];

    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const { unit, ms } of units) {
      const value = diffMs / ms;
      if (Math.abs(value) >= 1) {
        return formatter.format(Math.round(value), unit);
      }
    }

    return formatter.format(0, 'second');
  }

  private detectLocale(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      return 'en';
    }
  }

  private applyColor(
    text: string,
    type: 'timestamp' | 'user' | 'assistant' | 'meta' | 'assistantBody' | 'userBody',
    colorize: boolean,
  ): string {
    if (!colorize) {
      return text;
    }

    switch (type) {
      case 'timestamp':
      case 'meta':
        return chalk.dim(text);
      case 'assistant':
        return chalk.cyan(text);
      case 'user':
        return chalk.green(text);
      case 'assistantBody':
        return chalk.white(text);
      case 'userBody':
        return chalk.reset(text);
      default:
        return text;
    }
  }
}
