/**
 * @file template-processor
 *
 * CRITICAL: These tests MUST pass (simple, essential functionality):
 * - tests/utils/template-processor-simplified.test.ts (14 tests - Handlebars substitution)
 * - tests/services/agent-loader-integration.test.ts (6 tests - template in agents)
 *
 * Total: 20 essential tests that validate template processing and substitution.
 */

import * as Handlebars from 'handlebars';
import { DocumentLoaderService } from '../services/document-loader.service';
import type { TemplateContext } from '@sowonai/crewx-sdk';

/**
 * Process Handlebars template with document variables and context
 * 
 * Supports:
 * - {{{documents.doc-name.content}}} - Full document content
 * - {{{documents.doc-name.toc}}} - Table of contents
 * - {{documents.doc-name.summary}} - Document summary
 * - {{#if env.VAR_NAME}}...{{/if}} - Environment variable conditions
 * - {{#if agent.model}}...{{/if}} - Agent metadata conditions
 * - {{#if (eq mode "query")}}...{{/if}} - Mode-based conditions
 * - {{#if tools}}...{{/if}} - Check if tools are available
 * - {{{tools.json}}} - All tools as JSON string
 * - {{tools.count}} - Number of available tools
 * - {{vars.customKey}} - Custom variables
 * 
 * @param template - Template string with Handlebars variables
 * @param documentLoader - DocumentLoaderService instance
 * @param additionalContext - Optional additional context (env, options, agent, mode, tools, vars)
 * @returns Processed template with all context injected
 */
export async function processDocumentTemplate(
  template: string,
  documentLoader: DocumentLoaderService,
  additionalContext?: TemplateContext,
): Promise<string> {
  if (!documentLoader.isInitialized()) {
    // Even without documents, we might have other context
    if (!additionalContext) {
      return template;
    }
  }

  // Build context object with all available data
  const context: any = {
    documents: {},
    env: additionalContext?.env || process.env,
    agent: additionalContext?.agent || {},
    agentMetadata: additionalContext?.agentMetadata || {},
    mode: additionalContext?.mode,
    messages: additionalContext?.messages || [],
    platform: additionalContext?.platform,
    tools: additionalContext?.tools,
    vars: additionalContext?.vars || {},
  };

  // Register Handlebars helpers for advanced conditions
  registerHandlebarsHelpers();

  // Extract document references from template
  // Pattern: {{{documents.doc-name.property}}} or {{documents.doc-name.property}}
  const pattern = /(\{\{\{|\{\{)documents\.([^.}]+)\.([^}]+)}}}?/g;
  const matches = [...template.matchAll(pattern)];

  if (matches.length > 0 && documentLoader.isInitialized()) {
    const docProps = new Map<string, Map<string, string[]>>();

    for (const match of matches) {
      const [, , docName, prop] = match;
      if (!docName || !prop) {
        continue;
      }
      const propMap = docProps.get(docName) ?? new Map<string, string[]>();
      const expressions = propMap.get(prop) ?? [];
      expressions.push(match[0]);
      propMap.set(prop, expressions);
      docProps.set(docName, propMap);
    }

    for (const [docName, propMap] of docProps.entries()) {
      const shouldRender =
        typeof documentLoader.shouldRenderDocument === 'function'
          ? documentLoader.shouldRenderDocument(docName)
          : false;

      let content = await documentLoader.getDocumentContent(docName);
      let toc = await documentLoader.getDocumentToc(docName);
      let summary = await documentLoader.getDocumentSummary(docName);

      if (shouldRender && content) {
        try {
          const docTemplate = Handlebars.compile(content, { noEscape: true });
          content = docTemplate(context);
        } catch {
          // leave as-is
        }
      }

      const valueFor = (prop: string, value: string | undefined): string => {
        if (value) {
          return value;
        }
        if (shouldRender) {
          return '';
        }
        const expressions = propMap.get(prop);
        if (expressions && expressions.length > 0) {
          return expressions[0]!;
        }
        return "";
      };

      context.documents[docName] = {
        content: propMap.has('content') ? valueFor('content', content) : '',
        toc: propMap.has('toc') ? valueFor('toc', toc) : '',
        summary: propMap.has('summary') ? valueFor('summary', summary) : '',
      };
    }
  }

  // Compile and render main template
  const compiledTemplate = Handlebars.compile(template, { noEscape: true });
  return compiledTemplate(context);
}

/**
 * Register custom Handlebars helpers for conditions and comparisons
 */
function registerHandlebarsHelpers() {
  // Only register once
  if (Handlebars.helpers['eq']) {
    return;
  }

  // Equality helper: {{#if (eq a b)}}
  Handlebars.registerHelper('eq', function(a: any, b: any) {
    return a === b;
  });

  // Not equal helper: {{#if (ne a b)}}
  Handlebars.registerHelper('ne', function(a: any, b: any) {
    return a !== b;
  });

  // Contains helper: {{#if (contains array value)}}
  Handlebars.registerHelper('contains', function(array: any[], value: any) {
    return Array.isArray(array) && array.includes(value);
  });

  // Logical AND: {{#if (and a b)}}
  Handlebars.registerHelper('and', function(a: any, b: any) {
    return a && b;
  });

  // Logical OR: {{#if (or a b)}}
  Handlebars.registerHelper('or', function(a: any, b: any) {
    return a || b;
  });

  // Not helper: {{#if (not a)}}
  Handlebars.registerHelper('not', function(a: any) {
    return !a;
  });

  // JSON stringify helper: {{{json object}}}
  Handlebars.registerHelper('json', function(context: any) {
    return JSON.stringify(context, null, 2);
  });

  // Truncate helper: {{truncate text 500}} or {{{truncate text 500}}}
  Handlebars.registerHelper('truncate', function(text: string, maxLength: number) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    const remaining = text.length - maxLength;
    return `${text.substring(0, maxLength)} (...+${remaining} chars)`;
  });

  // Length helper: {{length array}}
  Handlebars.registerHelper('length', function(array: any) {
    if (Array.isArray(array)) return array.length;
    if (typeof array === 'string') return array.length;
    return 0;
  });

  // Helper to escape Handlebars tokens in user content
  Handlebars.registerHelper('escapeHandlebars', function(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }
    // Escape {{ and }} to prevent secondary template compilation
    return text.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
  });

  // Format file size in human-readable format
  Handlebars.registerHelper('formatFileSize', function(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  });

  // Format conversation helper - supports both default and custom templates
  // 
  // Usage 1: Use default template (recommended)
  //   {{{formatConversation messages platform}}}
  //
  // Usage 2: Custom template (full control)
  //   {{#formatConversation messages platform}}
  //   <custom-messages>
  //   {{#each messages}}
  //   **{{text}}**
  //   {{/each}}
  //   </custom-messages>
  //   {{/formatConversation}}
  //
  Handlebars.registerHelper('formatConversation', function(messages: any, platform: any, options?: any) {
    // Load Logger immediately
    const { Logger: NestLogger } = require('@nestjs/common');
    const helperLogger = new NestLogger('FormatConversation');
    
    // Handle block helper invocation
    const isBlockHelper = options && typeof options.fn === 'function';
    
    // ALWAYS log when this helper is called
    helperLogger.log(`🔧 formatConversation helper called! Mode: ${isBlockHelper ? 'CUSTOM' : 'DEFAULT'}`);
    helperLogger.log(`Messages type: ${typeof messages}, Is array: ${Array.isArray(messages)}, Length: ${messages?.length || 0}`);
    helperLogger.log(`Platform: ${platform}`);

    const assistantAgentIds: string[] = Array.isArray(messages)
      ? Array.from(new Set(
          messages
            .filter((msg: any) => msg?.isAssistant && msg?.metadata?.agent_id)
            .map((msg: any) => msg.metadata.agent_id),
        ))
      : [];

    const primaryAgentId = assistantAgentIds.length > 0 ? assistantAgentIds[0] : '';
    
    if (!messages || messages.length === 0) {
      helperLogger.warn(`⚠️ formatConversation: messages empty or undefined, returning empty string`);
      return '';
    }

    let content: string;

    if (isBlockHelper) {
      // CUSTOM MODE: User provided their own template in the block
      helperLogger.log(`📝 Using CUSTOM user template from block`);
      content = options.fn({
        messages,
        platform,
        messagesCount: messages.length,
        agentIds: assistantAgentIds,
        primaryAgentId,
      });
      helperLogger.debug(`📤 Custom template rendered output length: ${content.length} characters`);
    } else {
      // DEFAULT MODE: Load default template from .crewx/templates directory
      helperLogger.log(`📦 Using DEFAULT template from .crewx/templates`);
      
      const fs = require('fs');
      const path = require('path');
      
      const templatePath = path.join(process.cwd(), '.crewx', 'templates', 'conversation-history-default.hbs');

      let templateContent: string;
      let templateSource = 'inline-fallback';
      try {
        templateContent = fs.readFileSync(templatePath, 'utf8');
        templateSource = templatePath;
        helperLogger.debug(`✅ Loaded conversation template from: ${templatePath}`);
        helperLogger.debug(`📏 Template content length: ${templateContent.length} characters`);
        helperLogger.debug(`📊 Messages count: ${messages.length}, Platform: ${platform}`);
        helperLogger.debug(`📝 First message sample: ${JSON.stringify(messages[0], null, 2)}`);
      } catch (error) {
        helperLogger.warn(`⚠️ Failed to load template from ${templatePath}, using inline fallback`);
        helperLogger.warn(`Error: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to inline template if file not found
        templateContent = `{{#if messages}}
{{#if primaryAgentId}}Primary agent: @{{primaryAgentId}}
{{else}}Primary agent: (unknown)
{{/if}}
Previous conversation ({{messagesCount}} messages):
{{#each messages}}
{{#if isAssistant}}
**Assistant{{#if metadata.agent_id}} (@{{metadata.agent_id}}){{/if}}**
{{else}}
**{{#if metadata.slack}}{{#with metadata.slack}}{{#if user_profile.display_name}}{{user_profile.display_name}}{{else if username}}{{username}}{{else if user_id}}User ({{user_id}}){{else}}User{{/if}}{{/with}}{{else}}User{{/if}}**
{{/if}}: {{{escapeHandlebars text}}}
{{#if files}}
{{#each files}}
📎 {{name}} ({{formatFileSize size}}) - Local: {{localPath}}
{{/each}}
{{/if}}
{{/each}}{{/if}}`;
      }

      // Compile and render template
      // Note: helpers (length, truncate, eq, etc.) are already registered above
      const template = Handlebars.compile(templateContent, { noEscape: true });
      content = template({
        messages,
        platform,
        messagesCount: messages.length,
        agentIds: assistantAgentIds,
        primaryAgentId,
      });
      
      helperLogger.debug(`📤 Default template rendered output length: ${content.length} characters`);
      helperLogger.debug(`📍 Template source: ${templateSource}`);
    }
    
    // Wrap with <messages> tags for structural clarity in AI prompts
    const result = `${content}`;
    
    helperLogger.debug(`📄 Final output (with tags):\n${result}`);
    return result;
  });
}

/**
 * Check if a template contains document references
 */
export function hasDocumentReferences(template: string): boolean {
  return /{{{documents\.[^}]+}}}/g.test(template);
}
