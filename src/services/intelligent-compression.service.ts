import { Injectable, Logger } from '@nestjs/common';
import { ConversationMessage, ConversationThread } from '../conversation/conversation-history.interface';

/**
 * Intelligent Context Compression Service
 * Uses advanced algorithms for conversation history optimization
 */
@Injectable()
export class IntelligentCompressionService {
  private readonly logger = new Logger(IntelligentCompressionService.name);

  /**
   * Compress conversation history using intelligent strategies
   */
  async compressConversationHistory(
    thread: ConversationThread,
    options?: {
      maxTokens?: number;
      maxMessages?: number;
      preserveRecentCount?: number;
      preserveImportant?: boolean;
    }
  ): Promise<string> {
    const maxTokens = options?.maxTokens ?? 4000;
    const maxMessages = options?.maxMessages ?? 20;
    const preserveRecentCount = options?.preserveRecentCount ?? 5;
    const preserveImportant = options?.preserveImportant ?? true;

    if (thread.messages.length === 0) {
      return '';
    }

    // Step 1: 최근 메시지들은 항상 보존
    const recentMessages = thread.messages.slice(-preserveRecentCount);
    const olderMessages = thread.messages.slice(0, -preserveRecentCount);

    // Step 2: 중요한 메시지 식별
    const importantMessages = preserveImportant 
      ? this.identifyImportantMessages(olderMessages)
      : [];

    // Step 3: 압축 전략 적용
    const compressedHistory = await this.applyCompressionStrategy(
      olderMessages,
      importantMessages,
      recentMessages,
      maxTokens,
      maxMessages
    );

    return compressedHistory;
  }

  /**
   * 중요한 메시지 식별
   */
  private identifyImportantMessages(messages: ConversationMessage[]): ConversationMessage[] {
    const important: ConversationMessage[] = [];

    for (const message of messages) {
      // 중요도 판단 기준
      if (this.isImportantMessage(message)) {
        important.push(message);
      }
    }

    return important;
  }

  /**
   * 메시지 중요도 판단
   */
  private isImportantMessage(message: ConversationMessage): boolean {
    const text = message.text.toLowerCase();
    
    // 중요한 키워드들
    const importantKeywords = [
      'error', 'bug', 'issue', 'problem', 'fix', 'solution',
      'implement', 'create', 'build', 'design', 'architecture',
      'requirement', 'specification', 'goal', 'objective',
      'decision', 'conclusion', 'summary', 'result'
    ];

    // 코드 블록 포함 (중요한 기술적 내용)
    if (text.includes('```') || text.includes('`')) {
      return true;
    }

    // 긴 메시지 (상세한 설명)
    if (message.text.length > 200) {
      return true;
    }

    // 중요한 키워드 포함
    if (importantKeywords.some(keyword => text.includes(keyword))) {
      return true;
    }

    // 질문 형태 (? 포함)
    if (text.includes('?')) {
      return true;
    }

    return false;
  }

  /**
   * 압축 전략 적용
   */
  private async applyCompressionStrategy(
    olderMessages: ConversationMessage[],
    importantMessages: ConversationMessage[],
    recentMessages: ConversationMessage[],
    maxTokens: number,
    maxMessages: number
  ): Promise<string> {
    const sections: string[] = [];

    // Section 1: 중요한 메시지들의 요약
    if (importantMessages.length > 0) {
      const importantSummary = this.summarizeImportantMessages(importantMessages);
      sections.push(`## Key Discussion Points\n${importantSummary}`);
    }

    // Section 2: 전체 대화의 컨텍스트 요약
    if (olderMessages.length > importantMessages.length) {
      const contextSummary = this.generateContextSummary(olderMessages);
      sections.push(`## Conversation Context\n${contextSummary}`);
    }

    // Section 3: 최근 메시지들 (전체 텍스트)
    if (recentMessages.length > 0) {
      const recentText = recentMessages.map(msg => {
        const role = msg.isAssistant ? 'Assistant' : 'User';
        return `${role}: ${msg.text}`;
      }).join('\n');
      sections.push(`## Recent Messages\n${recentText}`);
    }

    const compressed = sections.join('\n\n');

    // 토큰 제한 확인 및 추가 압축
    if (this.estimateTokens(compressed) > maxTokens) {
      return this.applyFinalCompression(compressed, maxTokens);
    }

    return compressed;
  }

  /**
   * 중요한 메시지들 요약
   */
  private summarizeImportantMessages(messages: ConversationMessage[]): string {
    const summaries: string[] = [];

    for (const message of messages.slice(0, 10)) { // 최대 10개만
      const role = message.isAssistant ? 'Assistant' : 'User';
      const summary = this.summarizeMessage(message.text);
      summaries.push(`- ${role}: ${summary}`);
    }

    return summaries.join('\n');
  }

  /**
   * 단일 메시지 요약
   */
  private summarizeMessage(text: string): string {
    // 코드 블록 보존
    if (text.includes('```')) {
      const codeMatch = text.match(/```[\s\S]*?```/);
      if (codeMatch) {
        const beforeCode = text.substring(0, text.indexOf('```')).trim();
        return beforeCode ? `${beforeCode.substring(0, 100)}... ${codeMatch[0]}` : codeMatch[0];
      }
    }

    // 긴 텍스트 요약
    if (text.length > 150) {
      return text.substring(0, 147) + '...';
    }

    return text;
  }

  /**
   * 전체 컨텍스트 요약 생성
   */
  private generateContextSummary(messages: ConversationMessage[]): string {
    const topics = this.extractTopics(messages);
    const messageCount = messages.length;
    
    let summary = `Discussed ${messageCount} messages covering: ${topics.join(', ')}.`;
    
    // 주요 패턴 식별
    const patterns = this.identifyPatterns(messages);
    if (patterns.length > 0) {
      summary += ` Main patterns: ${patterns.join(', ')}.`;
    }

    return summary;
  }

  /**
   * 토픽 추출
   */
  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();
    const commonTopics = [
      'implementation', 'bug fixing', 'design', 'architecture', 
      'testing', 'optimization', 'configuration', 'deployment'
    ];

    for (const message of messages) {
      const text = message.text.toLowerCase();
      for (const topic of commonTopics) {
        if (text.includes(topic) || text.includes(topic.replace(' ', ''))) {
          topics.add(topic);
        }
      }
    }

    return Array.from(topics).slice(0, 5); // 최대 5개 토픽
  }

  /**
   * 패턴 식별
   */
  private identifyPatterns(messages: ConversationMessage[]): string[] {
    const patterns: string[] = [];

    // Q&A 패턴
    let questionCount = 0;
    let codeBlockCount = 0;
    
    for (const message of messages) {
      if (message.text.includes('?')) questionCount++;
      if (message.text.includes('```')) codeBlockCount++;
    }

    if (questionCount > messages.length * 0.3) {
      patterns.push('Q&A session');
    }
    
    if (codeBlockCount > 3) {
      patterns.push('code-heavy discussion');
    }

    return patterns;
  }

  /**
   * 토큰 수 추정 (간단한 휴리스틱)
   */
  private estimateTokens(text: string): number {
    // 대략적인 토큰 추정: 영어 기준 4글자당 1토큰
    // 실제로는 더 정확한 토크나이저를 사용해야 함
    return Math.ceil(text.length / 4);
  }

  /**
   * 최종 압축 (토큰 제한 초과시)
   */
  private applyFinalCompression(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // 비율에 따라 텍스트 길이 조정
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio * 0.9); // 안전 마진

    // 문장 단위로 자르기 시도
    const sentences = text.split('. ');
    let compressed = '';
    
    for (const sentence of sentences) {
      if (compressed.length + sentence.length + 2 <= targetLength) {
        compressed += (compressed ? '. ' : '') + sentence;
      } else {
        break;
      }
    }

    return compressed + (compressed.endsWith('.') ? '' : '... [compressed]');
  }
}