import { describe, it, expect } from 'vitest';
import { processDocumentTemplate } from '../../../src/utils/template-processor';
import { DocumentLoaderService } from '../../../src/services/document-loader.service';
import * as Handlebars from 'handlebars';

describe('template-processor', () => {
  const mockDocumentLoader = {
    isInitialized: () => false,
  } as unknown as DocumentLoaderService;

  it('should register formatTimestamp helper and format date', async () => {
    // Trigger helper registration - must pass additionalContext to bypass early return
    await processDocumentTemplate('', mockDocumentLoader, {});
    
    const timestamp = new Date('2024-05-15T10:30:00Z');
    const template = Handlebars.compile('{{formatTimestamp ts}}');
    const result = template({ ts: timestamp });
    
    // Check for essential date parts (YYYY. MM. DD.) which is typical for ko-KR
    // or YYYY-MM-DD depending on implementation details of node environment
    expect(result).toContain('2024');
    expect(result).toContain('05');
    // We avoid checking day/hour to avoid timezone flakiness in test environment
    // unless we force timezone.
  });

  it('should handle invalid date gracefully', async () => {
    await processDocumentTemplate('', mockDocumentLoader, {});
    const template = Handlebars.compile('{{formatTimestamp ts}}');
    const result = template({ ts: 'invalid-date' });
    expect(result).toBe('');
  });
});
