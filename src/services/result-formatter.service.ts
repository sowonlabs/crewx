
import { Injectable } from '@nestjs/common';
import { AgentResponse } from '../agent.types';

// Define interfaces for structured results to ensure consistency
export interface FormattedSingleResult {
  cli: string;
  mcp: string;
}

export interface FormattedParallelResult {
  cli: string;
  mcp: string;
}

export interface ParallelResultSummary {
  total: number;
  success: number;
  failed: number;
  totalDuration: number;
  averageDuration: number;
  fastest: number;
  slowest: number;
  timeSaved: number;
}

@Injectable()
export class ResultFormatterService {
  
  // Format a single agent operation result
  formatSingleResult(result: AgentResponse, readOnly: boolean): FormattedSingleResult {
    const cliOutput = this.formatSingleCli(result, readOnly);
    const mcpOutput = this.formatSingleMcp(result, readOnly);
    return { cli: cliOutput, mcp: mcpOutput };
  }

  // Format parallel agent operation results
  formatParallelResult(results: any[], summary: ParallelResultSummary, readOnly: boolean): FormattedParallelResult {
    const cliOutput = this.formatParallelCli(results, summary, readOnly);
    const mcpOutput = this.formatParallelMcp(results, summary, readOnly);
    return { cli: cliOutput, mcp: mcpOutput };
  }

  // ===================================================================
  // CLI Formatters
  // ===================================================================

  private formatSingleCli(result: AgentResponse, readOnly: boolean): string {
    // Simple text-based formatting for the console
    let output = `
--- Agent: ${result.agent} (${result.provider}) ---
`;
    if (result.taskId) {
      output += `Task ID: ${result.taskId}
`;
    }
    output += `Status: ${result.success ? '✅ Success' : '❌ Failed'}
`;
    if (readOnly) {
      output += `Mode: Read-Only
`;
    }
    if (result.error) {
      output += `Error: ${result.error}
`;
    }
    output += `
${result.content}
`;
    return output;
  }

  private formatParallelCli(results: any[], summary: ParallelResultSummary, readOnly: boolean): string {
    let output = `
--- Parallel Operation Summary ---
`;
    output += `Total: ${summary.total}, Success: ${summary.success}, Failed: ${summary.failed}
`;
    output += `Total Duration: ${summary.totalDuration}ms, Avg: ${summary.averageDuration}ms
`;
    if (readOnly) {
      output += `Mode: Read-Only
`;
    }
    
    results.forEach(result => {
      output += `
--- Agent: ${result.agentId} (${result.provider}) ---
`;
      if (result.taskId) {
        output += `Task ID: ${result.taskId}
`;
      }
      output += `Status: ${result.success ? '✅ Success' : '❌ Failed'}
`;
      output += `Duration: ${result.duration}ms
`;
      if (result.error) {
        output += `Error: ${result.error}
`;
      }
      output += `
${result.response || result.implementation}
`;
    });

    return output;
  }

  // ===================================================================
  // MCP Formatters
  // ===================================================================

  private formatSingleMcp(result: AgentResponse, readOnly: boolean): string {
    // Markdown-based formatting for MCP
    const title = readOnly ? '🤖 Agent Query Response (Read-Only Mode)' : '⚡ Agent Execution Response';
    
    return `**${title}**

**Agent:** ${result.agent} (${result.provider})
${result.taskId ? `**Task ID:** ${result.taskId}
` : ''}**Status:** ${result.success ? '✅ Success' : '❌ Failed'}
${result.error ? `**Error:** ${result.error}
` : ''}
**Response:**
${result.content}
`;
  }

  private formatParallelMcp(results: any[], summary: ParallelResultSummary, readOnly: boolean): string {
    const title = readOnly ? '🚀 Parallel Agent Queries Results' : '⚡ Parallel Agent Execution Results';

    const resultsText = results.map(result => `---
**Agent: ${result.agentId}** (${result.provider}) - ${result.duration}ms
${result.taskId ? `**Task ID:** ${result.taskId}
` : ''}**Status:** ${result.success ? '✅ Success' : '❌ Failed'}
${result.error ? `**Error:** ${result.error}
` : ''}
**Response:**
${result.response || result.implementation}
`).join('\n');

    return `**${title}**

**Summary:**
- Total Operations: ${summary.total}
- Successful: ${summary.success}
- Failed: ${summary.failed}
- Total Duration: ${summary.totalDuration}ms
- Average Duration: ${summary.averageDuration}ms

**Performance Insights:**
- Fastest: ${summary.fastest}ms
- Slowest: ${summary.slowest}ms
- Time Saved (vs sequential): ~${summary.timeSaved}ms

**Individual Results:**
${resultsText}
`;
  }
}
