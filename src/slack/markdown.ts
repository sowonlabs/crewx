/**
 * Lightweight Markdown → Slack mrkdwn converter.
 * Ported from cli-bak formatters, stripped of NestJS / md-to-slack deps.
 */

const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /(?<!\*)\*([^*]+)\*(?!\*)/g;
const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const UNORDERED_LIST_RE = /^[\s]*[-*]\s+/gm;
const ORDERED_LIST_RE = /^[\s]*(\d+)\.\s+/gm;

export function markdownToMrkdwn(text: string): string {
  if (!text) return '';

  let result = text;

  result = result.replace(CODE_BLOCK_RE, (_match, _lang, code) => {
    return `\`\`\`${code.trim()}\`\`\``;
  });

  result = result.replace(INLINE_CODE_RE, '`$1`');

  result = result.replace(HEADING_RE, (_match, _hashes, content) => {
    return `*${content.trim()}*`;
  });

  result = result.replace(BOLD_RE, '*$1*');

  result = result.replace(ITALIC_RE, '_$1_');

  result = result.replace(LINK_RE, '<$2|$1>');

  result = result.replace(UNORDERED_LIST_RE, '• ');

  result = result.replace(ORDERED_LIST_RE, '$1. ');

  return result;
}
