import { Block, KnownBlock } from '@slack/web-api';

export interface ExecutionResult {
  agent: string;
  provider: string;
  taskId: string;
  response: string;
  success: boolean;
  error?: string;
}

export class SlackMessageFormatter {
  // Slack limits: 3000 chars per text block, 50 blocks max, 40000 chars total
  // Default to ~100K tokens (approximately 400K characters for code-heavy content)
  // Can be overridden with SLACK_MAX_RESPONSE_LENGTH env var
  private readonly maxResponseLength: number;
  private readonly maxBlockLength = 2900; // Per block limit with safety margin
  private markdownToSlackFn: ((text: string) => string) | null = null;

  constructor() {
    // Default: 400000 chars (~100K tokens for code)
    // Set lower if you experience issues (e.g., 40000 for Slack message limit)
    this.maxResponseLength = parseInt(
      process.env.SLACK_MAX_RESPONSE_LENGTH || '400000',
      10
    );
    this.loadMarkdownConverter();
  }

  private async loadMarkdownConverter(): Promise<void> {
    try {
      const { markdownToSlack } = await import('md-to-slack');
      this.markdownToSlackFn = markdownToSlack;
    } catch (error) {
      console.error('Failed to load md-to-slack:', error);
      // Fallback to identity function
      this.markdownToSlackFn = (text: string) => text;
    }
  }

  /**
   * Format execution result into Slack blocks
   */
  formatExecutionResult(result: ExecutionResult): (Block | KnownBlock)[] {
    const blocks: (Block | KnownBlock)[] = [];

    if (result.success) {
      // Success: Show only the response content (clean!)
      const response = this.truncateForSlack(result.response, this.maxResponseLength);

      // Convert markdown to Slack mrkdwn format
      const slackFormatted = this.convertMarkdownToMrkdwn(response);

      // Handle large messages: split into multiple sections if needed
      if (slackFormatted.length > 2900) {
        const adjustedMaxChars = this.validateBlockCount(slackFormatted, 2900);
        const sections = this.splitIntoSections(slackFormatted, adjustedMaxChars);

        sections.forEach((sectionText, index) => {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: sectionText,
            },
          });

          // Add divider only for smaller section counts to avoid hitting 50 block limit
          if (index < sections.length - 1 && sections.length < 10) {
            blocks.push({ type: 'divider' });
          }
        });
      } else {
        // Short responses use a single block
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: slackFormatted,
          },
        });
      }
    } else {
      // Error: Show error message with metadata
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error*\n\`\`\`${result.error || 'Unknown error'}\`\`\``,
        },
      });

      // Add metadata context only on error
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Agent: *${result.agent}* (${result.provider}) · Task ID: \`${result.taskId}\``,
          },
        ],
      });
    }

    // Add footer to all responses
    blocks.push(...this.createFooter());

    return blocks;
  }

  /**
   * Create CodeCrew promotional footer
   * This footer is displayed in Slack but removed from AI conversation history
   */
  private createFooter(): (Block | KnownBlock)[] {
    return [
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '$ crewx | <https://github.com/sowonlabs/crewx|github.com/sowonlabs/crewx>',
          },
        ],
      },
    ];
  }

  /**
   * Convert markdown to Slack mrkdwn format
   */
  private convertMarkdownToMrkdwn(text: string): string {
    if (!text) return '';

    // 1. Convert headings to **bold** markdown first (so md-to-slack converts them)
    const withHeadings = text.replace(/^(#{1,6})\s+(.+)$/gm, '**$2**');

    // 2. Basic markdown -> mrkdwn conversion
    const slackText = this.markdownToSlackFn
      ? this.markdownToSlackFn(withHeadings)
      : withHeadings;

    // 3. Convert emoji codes to Unicode
    const withEmoji = this.convertEmojiCodes(slackText);

    return withEmoji;
  }

  /**
   * Convert emoji codes (:emoji_name:) to Unicode characters
   */
  private convertEmojiCodes(text: string): string {
    const emojiMap: Record<string, string> = {
      ':dart:': '🎯',
      ':white_check_mark:': '✅',
      ':rocket:': '🚀',
      ':bulb:': '💡',
      ':wrench:': '🔧',
      ':book:': '📚',
      ':fire:': '🔥',
      ':star:': '⭐',
      ':warning:': '⚠️',
      ':x:': '❌',
      ':sparkles:': '✨',
      ':mag:': '🔍',
      ':hammer:': '🔨',
      ':package:': '📦',
      ':bug:': '🐛',
      ':zap:': '⚡',
      ':art:': '🎨',
      ':lock:': '🔒',
      ':key:': '🔑',
      ':eyes:': '👀',
    };

    return text.replace(/:([a-z_]+):/g, (match, name) => {
      return emojiMap[`:${name}:`] || match;
    });
  }

  /**
   * Truncate text to fit Slack's limits
   */
  private truncateForSlack(text: string, maxLength: number): string {
    if (!text) return '';

    if (text.length <= maxLength) {
      return text;
    }

    // Try to break at a sensible point (newline or sentence)
    const searchStart = Math.max(0, maxLength - 500);
    let breakPoint = maxLength;

    const lastNewline = text.lastIndexOf('\n', maxLength);
    if (lastNewline > searchStart) {
      breakPoint = lastNewline;
    } else {
      const lastPeriod = text.lastIndexOf('. ', maxLength);
      if (lastPeriod > searchStart) {
        breakPoint = lastPeriod + 1;
      }
    }

    const truncatedText = text.substring(0, breakPoint);
    const estimatedTokens = Math.floor(text.length / 4); // Rough estimate

    return truncatedText + `\n\n_[Response truncated: ~${estimatedTokens.toLocaleString()} tokens. Adjust SLACK_MAX_RESPONSE_LENGTH env var if needed]_`;
  }

  /**
   * Format error message
   */
  formatError(error: string): (Block | KnownBlock)[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error*\n\`\`\`${error}\`\`\``,
        },
      },
    ];
  }

  /**
   * Format simple message
   */
  formatMessage(message: string, emoji?: string): (Block | KnownBlock)[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji || '💬'} ${message}`,
        },
      },
    ];
  }

  /**
   * Validate and adjust section size to stay within 50 block limit
   */
  private validateBlockCount(response: string, maxCharsPerSection: number): number {
    const estimatedBlocks = Math.ceil(response.length / maxCharsPerSection);
    const MAX_BLOCKS = 48; // 50 block limit with margin for header/footer

    if (estimatedBlocks > MAX_BLOCKS) {
      // Increase section size to fit within block limit
      return Math.ceil(response.length / MAX_BLOCKS);
    }

    return maxCharsPerSection;
  }

  /**
   * Split text into sections that fit within Slack's 3000 char limit
   * Breaks at newlines to preserve markdown formatting
   */
  private splitIntoSections(text: string, maxLength: number): string[] {
    if (!text || text.length <= maxLength) {
      return [text];
    }

    const sections: string[] = [];
    let currentSection = '';
    const lines = text.split('\n');

    for (const line of lines) {
      const lineWithNewline = line + '\n';

      // If adding this line would exceed the limit
      if (currentSection.length + lineWithNewline.length > maxLength) {
        // If current section is not empty, save it
        if (currentSection) {
          sections.push(currentSection.trimEnd());
          currentSection = '';
        }

        // If a single line is longer than maxLength, split it
        if (lineWithNewline.length > maxLength) {
          let remainingLine = lineWithNewline;
          while (remainingLine.length > maxLength) {
            sections.push(remainingLine.substring(0, maxLength));
            remainingLine = remainingLine.substring(maxLength);
          }
          currentSection = remainingLine;
        } else {
          currentSection = lineWithNewline;
        }
      } else {
        currentSection += lineWithNewline;
      }
    }

    // Add the last section if not empty
    if (currentSection) {
      sections.push(currentSection.trimEnd());
    }

    return sections;
  }
}
