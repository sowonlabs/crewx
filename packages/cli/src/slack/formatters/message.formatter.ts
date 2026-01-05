import { Block, KnownBlock } from '@slack/web-api';
import {
  BaseMessageFormatter,
  StructuredMessage,
  FormatterOptions,
} from '@sowonai/crewx-sdk';

export interface ExecutionResult {
  agent: string;
  provider: string;
  taskId: string;
  response: string;
  success: boolean;
  error?: string;
}

/**
 * Slack-specific message formatter
 *
 * Extends SDK BaseMessageFormatter to add:
 * - Slack block formatting
 * - Markdown to Slack mrkdwn conversion
 * - Emoji code conversion
 * - Slack-specific truncation and splitting
 */
export class SlackMessageFormatter extends BaseMessageFormatter {
  // Slack limits: 3000 chars per text block, 50 blocks max, 40000 chars total
  // Default to ~100K tokens (approximately 400K characters for code-heavy content)
  // Can be overridden with SLACK_MAX_RESPONSE_LENGTH env var
  private readonly maxResponseLength: number;
  private readonly maxBlockSize: number; // Per block limit with safety margin
  private markdownToSlackFn: (text: string) => string;

  constructor() {
    super();
    // Default: 400000 chars (~100K tokens for code)
    // Set lower if you experience issues (e.g., 40000 for Slack message limit)
    this.maxResponseLength = parseInt(
      process.env.SLACK_MAX_RESPONSE_LENGTH || '400000',
      10
    );
    // Default: 2900 chars (max 3000 for Slack)
    // Safety margin to avoid hitting Slack's 3000 char limit per block
    this.maxBlockSize = Math.min(
      parseInt(process.env.SLACK_MAX_BLOCK_SIZE || '2900', 10),
      3000
    );
    // Load markdown converter synchronously to avoid race condition
    this.markdownToSlackFn = this.loadMarkdownConverter();
  }

  /**
   * Load markdown converter synchronously using require()
   * This avoids race condition where markdownToSlackFn is null when convertMarkdownToMrkdwn is called
   */
  private loadMarkdownConverter(): (text: string) => string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { markdownToSlack } = require('md-to-slack');
      return markdownToSlack;
    } catch (error) {
      console.error('Failed to load md-to-slack:', error);
      // Fallback to identity function
      return (text: string) => text;
    }
  }

  /**
   * Override formatMessage to use Slack-specific formatting
   */
  override formatMessage(
    msg: StructuredMessage,
    options?: FormatterOptions,
  ): string {
    if (!msg || !msg.text) {
      return '';
    }

    const opts = this.getDefaultOptions({
      platform: 'slack',
      userPrefix: ':bust_in_silhouette:',
      assistantPrefix: ':robot_face:',
      ...options,
    });

    const headerParts: string[] = [];

    // Add prefix with Slack emoji
    const prefix = msg.isAssistant
      ? opts.assistantPrefix!
      : opts.userPrefix!;
    headerParts.push(prefix);

    const slackMetadata = (msg.metadata as any)?.slack ?? {};
    const slackUserId: string | undefined = slackMetadata.user_id || slackMetadata.bot_user_id;
    const displayName =
      slackMetadata.user_profile?.display_name ||
      slackMetadata.username ||
      slackMetadata.bot_username ||
      this.resolveDisplayName(msg) ||
      msg.userId;

    // Add user/agent identifier with standardized Slack mention format
    if (opts.includeUserId) {
      if (slackUserId) {
        headerParts.push(`<@${slackUserId}>`);
      } else if (displayName) {
        headerParts.push(`*${displayName}*`);
      }
    }

    if (msg.isAssistant && (msg.metadata as any)?.agent_id) {
      headerParts.push(`(${(msg.metadata as any).agent_id})`);
    }

    // Add timestamp if requested
    if (opts.includeTimestamp && msg.timestamp) {
      const timestamp = this.normalizeTimestamp(msg.timestamp);
      headerParts.push(`_${timestamp}_`);
    }

    const header = headerParts.join(' ');

    // Convert markdown to Slack mrkdwn and standardize mentions
    const slackText = this.sanitizeText(
      this.standardizeMentions(this.convertMarkdownToMrkdwn(msg.text)),
      opts.maxLength,
    );

    return `${header}: ${slackText}`;
  }

  /**
   * Format execution result into Slack blocks
   */
  formatExecutionResult(result: ExecutionResult): (Block | KnownBlock)[] {
    const blocks: (Block | KnownBlock)[] = [];

    if (result.success) {
      // Success: Show only the response content (clean!)
      let response = this.truncateForSlack(result.response, this.maxResponseLength);

      // Convert markdown to Slack mrkdwn format
      let slackFormatted = this.convertMarkdownToMrkdwn(response);

      // Check if we need additional truncation due to block limits
      const adjustedMaxChars = this.validateBlockCount(slackFormatted, this.maxBlockSize);
      const maxTotalLength = adjustedMaxChars * 48; // 48 blocks max

      // If text still exceeds what we can fit in 48 blocks, truncate it
      if (slackFormatted.length > maxTotalLength) {
        response = this.truncateForSlack(result.response, maxTotalLength * 0.95); // Leave margin
        slackFormatted = this.convertMarkdownToMrkdwn(response);

        // Issue #59: After re-conversion, content may still exceed block size limit
        // md-to-slack conversion can increase character count due to escaping
        // Force another check to ensure we stay within limits
        if (slackFormatted.length > maxTotalLength) {
          // Final truncation at mrkdwn level (post-conversion)
          slackFormatted = this.truncateAtMrkdwnLevel(slackFormatted, maxTotalLength);
        }
      }

      // Handle large messages: split into multiple sections if needed
      if (slackFormatted.length > this.maxBlockSize) {
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
   * Create CrewX promotional footer
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
    const slackText = this.markdownToSlackFn(withHeadings);

    // 3. Post-process: Convert remaining **bold** patterns to Slack *bold*
    // md-to-slack doesn't convert bold text inside list items (e.g., "- **text**")
    const withBold = slackText.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    // 4. Convert emoji codes to Unicode
    const withEmoji = this.convertEmojiCodes(withBold);

    return withEmoji;
  }

  /**
   * Normalize mention syntax to Slack format (<@USERID>)
   */
  private standardizeMentions(text: string): string {
    if (!text) {
      return '';
    }

    return text
      .replace(/<@?([UW][A-Z0-9]{8,})>?/g, '<@$1>')
      .replace(/@([UW][A-Z0-9]{8,})\b/g, '<@$1>');
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
      ':bust_in_silhouette:': '👤',
      ':robot_face:': '🤖',
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
   * Format simple message (Slack-specific block format)
   */
  formatSimpleMessage(message: string, emoji?: string): (Block | KnownBlock)[] {
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
   * Also enforces the per-block character limit (SLACK_MAX_BLOCK_SIZE)
   */
  private validateBlockCount(response: string, maxCharsPerSection: number): number {
    const estimatedBlocks = Math.ceil(response.length / maxCharsPerSection);
    const MAX_BLOCKS = 48; // 50 block limit with margin for header/footer

    if (estimatedBlocks > MAX_BLOCKS) {
      // Try to increase section size to fit within block limit
      const idealSectionSize = Math.ceil(response.length / MAX_BLOCKS);

      // If ideal section size exceeds block size limit, we must truncate
      // This prevents invalid_blocks error from Slack API
      if (idealSectionSize > this.maxBlockSize) {
        // Keep section size at maximum allowed
        // The text will be truncated in truncateForSlack() if needed
        return this.maxBlockSize;
      }

      return idealSectionSize;
    }

    return maxCharsPerSection;
  }

  /**
   * Split text into sections that fit within Slack's 3000 char limit
   * Breaks at newlines to preserve markdown formatting
   *
   * Issue #59: Enhanced to handle Gemini-style responses without line breaks
   * - Forces split at maxLength even when there are no newlines
   * - Tries to find safe break points (space, punctuation) within long lines
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

        // If a single line is longer than maxLength, split it smartly
        if (lineWithNewline.length > maxLength) {
          const splitLines = this.forceSplitLongLine(lineWithNewline, maxLength);
          // Add all but the last segment as complete sections
          for (let i = 0; i < splitLines.length - 1; i++) {
            const segment = splitLines[i];
            if (segment) {
              sections.push(segment.trimEnd());
            }
          }
          // Keep the last segment as current section (may combine with next line)
          currentSection = splitLines[splitLines.length - 1] ?? '';
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

    // Final safety check: ensure NO section exceeds maxLength
    // This handles edge cases where combining left a section too long
    return this.ensureMaxLength(sections, maxLength);
  }

  /**
   * Force split a long line at safe break points
   * Issue #59: Gemini often generates code/text without line breaks
   *
   * Priority for break points:
   * 1. Space character (word boundary)
   * 2. Punctuation (., ,, ;, :, ], ), })
   * 3. Hard cut at maxLength (last resort)
   */
  private forceSplitLongLine(line: string, maxLength: number): string[] {
    const segments: string[] = [];
    let remaining = line;

    while (remaining.length > maxLength) {
      // Find best break point within maxLength
      let breakPoint = this.findBestBreakPoint(remaining, maxLength);

      // If no good break point found, hard cut
      if (breakPoint <= 0) {
        breakPoint = maxLength;
      }

      segments.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint);

      // Skip leading spaces after break (clean up)
      if (remaining.startsWith(' ')) {
        remaining = remaining.trimStart();
      }
    }

    if (remaining) {
      segments.push(remaining);
    }

    return segments;
  }

  /**
   * Find the best break point within maxLength
   * Returns position to break at, or 0 if no good break point found
   */
  private findBestBreakPoint(text: string, maxLength: number): number {
    // Search from maxLength backwards for a safe break point
    // Look in the last 20% of the allowed range to avoid very short segments
    const searchStart = Math.floor(maxLength * 0.8);

    // Priority 1: Last space before maxLength (word boundary)
    const lastSpace = text.lastIndexOf(' ', maxLength);
    if (lastSpace >= searchStart) {
      return lastSpace + 1; // Include the space in current segment
    }

    // Priority 2: Punctuation marks
    const punctuation = ['. ', ', ', '; ', ': ', '] ', ') ', '} '];
    for (const punct of punctuation) {
      const pos = text.lastIndexOf(punct, maxLength);
      if (pos >= searchStart) {
        return pos + punct.length;
      }
    }

    // Priority 3: Any space (even earlier in the string)
    if (lastSpace > 0) {
      return lastSpace + 1;
    }

    // No good break point found, will hard cut
    return 0;
  }

  /**
   * Ensure all sections are within maxLength
   * Final safety net for edge cases
   */
  private ensureMaxLength(sections: string[], maxLength: number): string[] {
    const result: string[] = [];

    for (const section of sections) {
      if (section.length <= maxLength) {
        result.push(section);
      } else {
        // Section still too long, force split again
        const splits = this.forceSplitLongLine(section, maxLength);
        result.push(...splits.map((s) => s.trimEnd()).filter((s) => s));
      }
    }

    return result;
  }

  /**
   * Truncate at mrkdwn level (post-conversion)
   * Issue #59: When md-to-slack conversion increases length beyond limit
   */
  private truncateAtMrkdwnLevel(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to break at a paragraph or sentence
    const searchStart = Math.max(0, maxLength - 500);
    let breakPoint = maxLength;

    // Try paragraph break first
    const lastDoubleNewline = text.lastIndexOf('\n\n', maxLength);
    if (lastDoubleNewline > searchStart) {
      breakPoint = lastDoubleNewline;
    } else {
      // Try single newline
      const lastNewline = text.lastIndexOf('\n', maxLength);
      if (lastNewline > searchStart) {
        breakPoint = lastNewline;
      } else {
        // Try sentence end
        const lastPeriod = text.lastIndexOf('. ', maxLength);
        if (lastPeriod > searchStart) {
          breakPoint = lastPeriod + 1;
        }
      }
    }

    return text.substring(0, breakPoint) + '\n\n_[Truncated due to Slack limits]_';
  }
}
