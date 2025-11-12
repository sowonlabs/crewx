# MCP Integration Example

This example demonstrates how to integrate Model Context Protocol (MCP) servers with CrewX agents.

## Overview

This example shows:
- MCP server configuration
- GitHub MCP integration
- Slack MCP integration
- Filesystem MCP integration
- Combining MCP tools with injected tools

## What is MCP?

Model Context Protocol (MCP) is a standardized protocol for connecting AI models to external tools and data sources. CrewX integrates MCP via the Mastra framework.

### Architecture

```
┌──────────────────┐
│  CrewX Agent     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Client      │
└────────┬─────────┘
         │ (stdio)
         ▼
┌──────────────────┐
│  MCP Server      │  ← GitHub, Slack, Filesystem, etc.
└──────────────────┘
```

## Prerequisites

- Node.js 18+
- CrewX CLI installed
- API keys (OpenAI, Anthropic, GitHub, Slack, etc.)
- `npx` available (for running MCP servers)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# GitHub (for GitHub MCP server)
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=myorg

# Slack (for Slack MCP server)
SLACK_BOT_TOKEN=xoxb-...
SLACK_TEAM_ID=T123456

# Other MCP servers
DATABASE_URL=postgresql://...
```

## Available MCP Servers

### Official MCP Servers

- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-filesystem` - File system access
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-google-drive` - Google Drive
- `@modelcontextprotocol/server-puppeteer` - Browser automation

## Examples

### Example 1: GitHub MCP Server

**File**: `crewx-github.yaml`

```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
      GITHUB_OWNER: "{{env.GITHUB_OWNER}}"

agents:
  - id: github_agent
    name: GitHub Manager
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
    mcp: [github]  # Activate GitHub MCP server
    inline:
      prompt: |
        You are a GitHub manager. Use GitHub tools to:
        - Search repositories (github:search_repositories)
        - Create issues (github:create_issue)
        - Review pull requests (github:get_pull_request)
        - Manage branches (github:create_branch)

        Always provide clear feedback about operations.
```

**Usage**:

```bash
crewx execute "@github_agent Search for machine learning repositories" -c crewx-github.yaml
```

**Expected MCP Tools**:

- `github:search_repositories` - Search GitHub repositories
- `github:create_issue` - Create new issue
- `github:get_pull_request` - Get PR details
- `github:create_branch` - Create new branch
- `github:update_file` - Update file contents

### Example 2: Slack MCP Server

**File**: `crewx-slack.yaml`

```yaml
mcp_servers:
  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "{{env.SLACK_BOT_TOKEN}}"
      SLACK_TEAM_ID: "{{env.SLACK_TEAM_ID}}"

agents:
  - id: slack_agent
    name: Slack Bot
    provider: api/openai
    model: gpt-4o
    temperature: 0.7
    mcp: [slack]  # Activate Slack MCP server
    inline:
      prompt: |
        You are a Slack bot. Use Slack tools to:
        - Send messages (slack:send_message)
        - List channels (slack:list_channels)
        - Read messages (slack:get_messages)
        - React to messages (slack:add_reaction)

        Be friendly and helpful in all communications.
```

**Usage**:

```bash
crewx execute "@slack_agent Send message to #engineering: Deploy completed" -c crewx-slack.yaml
```

**Expected MCP Tools**:

- `slack:send_message` - Send message to channel
- `slack:list_channels` - List all channels
- `slack:get_messages` - Read channel messages
- `slack:add_reaction` - Add emoji reaction
- `slack:upload_file` - Upload file to channel

### Example 3: Filesystem MCP Server

**File**: `crewx-filesystem.yaml`

```yaml
mcp_servers:
  filesystem:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/workspace"  # Allowed directory
    env:
      ALLOWED_DIRS: "/workspace,/tmp"

agents:
  - id: file_agent
    name: File Manager
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.5
    mcp: [filesystem]
    inline:
      prompt: |
        You are a file manager with access to the filesystem.

        Available tools:
        - filesystem:read_file - Read file contents
        - filesystem:write_file - Write to file
        - filesystem:list_directory - List directory contents
        - filesystem:create_directory - Create new directory

        Security: Only access files in /workspace and /tmp directories.
```

**Usage**:

```bash
crewx execute "@file_agent List files in /workspace" -c crewx-filesystem.yaml
crewx execute "@file_agent Read contents of /workspace/README.md" -c crewx-filesystem.yaml
```

### Example 4: Multi-MCP Integration

**File**: `crewx-multi-mcp.yaml`

```yaml
vars:
  company_name: TechCorp
  github_org: techcorp

mcp_servers:
  # GitHub integration
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
      GITHUB_OWNER: "{{vars.github_org}}"

  # Slack integration
  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "{{env.SLACK_BOT_TOKEN}}"
      SLACK_TEAM_ID: "{{env.SLACK_TEAM_ID}}"

  # Filesystem integration
  filesystem:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/workspace"

agents:
  - id: devops_agent
    name: DevOps Engineer
    provider: api/openai
    model: gpt-4o
    temperature: 0.5
    mcp: [github, slack, filesystem]  # Multiple MCP servers
    tools: [deploy_service, check_logs]  # Plus custom tools
    inline:
      prompt: |
        You are a DevOps engineer for {{vars.company_name}}.

        Available MCP tools:
        - GitHub: search_repositories, create_issue, get_pull_request
        - Slack: send_message, list_channels
        - Filesystem: read_file, write_file, list_directory

        Available custom tools:
        - deploy_service: Deploy to production
        - check_logs: Check application logs

        Workflow:
        1. Check deployment logs (filesystem)
        2. Deploy service (custom tool)
        3. Create GitHub issue if fails
        4. Notify team via Slack
```

**Usage**:

```bash
crewx execute "@devops_agent Deploy latest changes and notify team" -c crewx-multi-mcp.yaml

# Agent workflow:
# 1. Reads logs: filesystem:read_file(/workspace/logs/deploy.log)
# 2. Deploys: deploy_service()
# 3. If success: slack:send_message(#engineering, "Deploy successful")
# 4. If failure: github:create_issue(...) + slack:send_message(...)
```

### Example 5: Combining MCP + Custom Tools

**File**: `src/index.ts`

```typescript
import { CrewX } from '@crewx/sdk';
import { deployTool } from './tools/deploy.tool';
import { logsTool } from './tools/logs.tool';

const crewx = new CrewX({
  configPath: './crewx-multi-mcp.yaml',

  // Inject custom tools (work alongside MCP tools)
  tools: [
    deployTool,
    logsTool,
  ],
});

async function main() {
  const response = await crewx.runAgent('devops_agent', {
    input: 'Deploy latest changes and notify team',
    maxSteps: 15,  // Allow multiple tool calls
  });

  console.log(response.content);
}

main();
```

## MCP Tool Naming Convention

MCP tools are prefixed with server name:

```
github:search_repositories
github:create_issue
slack:send_message
slack:list_channels
filesystem:read_file
postgres:query
```

## Testing MCP Servers

### Test GitHub Server

```bash
# Test GitHub MCP server independently
GITHUB_TOKEN=xxx npx -y @modelcontextprotocol/server-github

# Should output available tools
```

### Test Slack Server

```bash
# Test Slack MCP server
SLACK_BOT_TOKEN=xxx SLACK_TEAM_ID=xxx npx -y @modelcontextprotocol/server-slack
```

### Test Filesystem Server

```bash
# Test filesystem server
npx -y @modelcontextprotocol/server-filesystem /workspace
```

## Running Examples

### GitHub Example

```bash
npm run start:github -- "Search for AI repositories in techcorp organization"
```

### Slack Example

```bash
npm run start:slack -- "Send message to #engineering: Test from CrewX"
```

### Multi-MCP Example

```bash
npm run start:multi -- "Deploy latest changes and notify team"
```

## Advanced Configuration

### Custom MCP Server

Create your own MCP server:

**File**: `mcp-servers/custom-api.js`

```javascript
#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');

class CustomAPIServer {
  constructor() {
    this.server = new Server({
      name: 'custom-api-server',
      version: '1.0.0',
    });

    this.setupTools();
  }

  setupTools() {
    // Define custom tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'fetch_data',
            description: 'Fetch data from custom API',
            inputSchema: {
              type: 'object',
              properties: {
                endpoint: { type: 'string' },
              },
              required: ['endpoint'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      if (request.params.name === 'fetch_data') {
        const { endpoint } = request.params.arguments;
        // Call your custom API
        const response = await fetch(`https://api.example.com/${endpoint}`);
        const data = await response.json();
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new CustomAPIServer();
server.run();
```

**YAML Configuration**:

```yaml
mcp_servers:
  custom_api:
    command: node
    args: ["./mcp-servers/custom-api.js"]
    env:
      API_KEY: "{{env.CUSTOM_API_KEY}}"
```

### Multiple GitHub Organizations

```yaml
mcp_servers:
  github_org1:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN_ORG1}}"
      GITHUB_OWNER: "org1"

  github_org2:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN_ORG2}}"
      GITHUB_OWNER: "org2"

agents:
  - id: multi_org_agent
    mcp: [github_org1, github_org2]
    inline:
      prompt: |
        Manage multiple GitHub organizations:
        - github_org1:* tools for org1
        - github_org2:* tools for org2
```

## Troubleshooting

### MCP Server Not Starting

**Error**:

```
Error: Failed to connect to MCP server 'github'
```

**Solution**:

1. Test server independently:

```bash
npx -y @modelcontextprotocol/server-github
```

2. Check environment variables:

```bash
echo $GITHUB_TOKEN
```

3. Verify server command:

```yaml
mcp_servers:
  github:
    command: npx  # Correct command
    args: ["-y", "@modelcontextprotocol/server-github"]
```

### Tools Not Available

**Error**:

```
Agent tried to call github:search_repositories but tool not found
```

**Solution**:

1. Verify MCP server is activated:

```yaml
agents:
  - id: my_agent
    mcp: [github]  # Must activate
```

2. Check server logs (enable debug):

```bash
export DEBUG=mcp:*
crewx execute "@my_agent test"
```

### Authentication Errors

**Error**:

```
Error: GitHub API authentication failed
```

**Solution**:

1. Verify token:

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

2. Check token permissions (needs repo, read:org scopes)

3. Regenerate token if necessary

## Security Considerations

### Filesystem Access

Limit filesystem access to specific directories:

```yaml
mcp_servers:
  filesystem:
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/workspace"  # Only this directory
    env:
      ALLOWED_DIRS: "/workspace,/tmp"  # Whitelist
```

### Token Management

Use environment variables, never hardcode:

```yaml
# ✅ Good
env:
  GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

# ❌ Bad
env:
  GITHUB_TOKEN: "ghp_hardcoded_token"
```

### Read-Only Mode

For sensitive operations, use read-only MCP tools:

```yaml
agents:
  - id: readonly_agent
    mcp: [github]
    inline:
      prompt: |
        You have READ-ONLY access. Use only:
        - github:search_repositories
        - github:get_pull_request

        DO NOT use:
        - github:create_issue
        - github:update_file
```

## Next Steps

- **API Reference**: See [../../docs/api-provider-reference.md](../../docs/api-provider-reference.md)
- **User Guide**: See [../../docs/api-provider-guide.md](../../docs/api-provider-guide.md)
- **Custom MCP Servers**: See [MCP Documentation](https://modelcontextprotocol.io)

## License

MIT
