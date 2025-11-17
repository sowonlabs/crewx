# Migration Guide: CLI Provider → API Provider

> **Version**: 0.1.x
> **Last Updated**: 2025-11-12

This guide helps you migrate from CLI Providers to API Providers, understanding when to use each, and how to transition smoothly.

---

## Table of Contents

1. [Understanding the Differences](#understanding-the-differences)
2. [When to Use CLI vs API Provider](#when-to-use-cli-vs-api-provider)
3. [Migration Strategies](#migration-strategies)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Configuration Changes](#configuration-changes)
6. [Provider Options Migration](#provider-options-migration)
7. [Tool Migration](#tool-migration)
8. [Testing & Validation](#testing--validation)
9. [Rollback Plan](#rollback-plan)
10. [FAQ](#faq)

---

## Understanding the Differences

### Architecture Comparison

**CLI Provider (Spawn-based):**

```
User → CrewX CLI → Spawn Process → Claude CLI/Gemini CLI → AI Model
                     ↓
              File System Access (direct)
```

**API Provider (HTTP-based):**

```
User → CrewX CLI → MastraAPIProvider → Vercel AI SDK → AI Model API
                        ↓
                   Function Injection (tools)
```

### Feature Comparison

| Feature | CLI Provider | API Provider |
|---------|-------------|--------------|
| **Deployment** | Local only | Local + Server |
| **Tool Calling** | Spawn-based | HTTP + Function injection |
| **Mode Distinction** | query vs execute (spawn flags) | No distinction (same HTTP) |
| **Performance** | Slower (process spawn) | Faster (HTTP) |
| **Streaming** | Yes (stdio) | Yes (HTTP SSE) |
| **MCP Support** | Limited | Full support |
| **Multi-model** | Provider array fallback | LiteLLM gateway |
| **File Access** | Direct filesystem | Via tools only |
| **Permissions** | OS-level | Tool-level |
| **Cost** | Provider cost only | Provider cost + gateway (opt) |

### Provider Types Mapping

| CLI Provider | API Provider Equivalent |
|--------------|------------------------|
| `cli/claude` | `api/anthropic` |
| `cli/gemini` | `api/google` |
| `cli/copilot` | `api/openai` (GPT-4) |

---

## When to Use CLI vs API Provider

### Use CLI Provider When

✅ **Local development with direct file access**
- Need to read/write local files directly
- IDE integration via MCP mode
- Debugging with file system permissions

✅ **Permission-based security model**
- Need OS-level file permissions
- Require spawn-based isolation

✅ **Existing CLI tools integration**
- Already using Claude CLI, Gemini CLI
- Complex spawn-based tool chains

**Example Use Cases:**
- Local code editor integration
- File system operations (read/write/search)
- Git operations with direct repo access
- Local development workflows

### Use API Provider When

✅ **Server/cloud deployment**
- Running in containerized environments
- Serverless functions (Lambda, Cloud Run)
- Web applications

✅ **HTTP-based tool calling**
- Tools that call external APIs
- Database queries
- Web scraping
- Third-party integrations

✅ **Multi-model routing**
- Need to switch models dynamically
- Load balancing across providers
- Cost optimization via LiteLLM

✅ **MCP server integration**
- GitHub, Slack, Google Drive integration
- Standardized tool protocols
- Third-party MCP servers

✅ **Function injection pattern**
- Tools defined in TypeScript
- Complex tool logic
- Shared tool libraries

**Example Use Cases:**
- Production web services
- Slack bots, Discord bots
- API endpoints
- Background workers
- Multi-model experimentation

---

## Migration Strategies

### Strategy 1: Big Bang Migration

**Timeline:** 1-2 weeks

Replace CLI providers with API providers all at once.

**Pros:**
- ✅ Clean cutover
- ✅ Simplified codebase
- ✅ No hybrid complexity

**Cons:**
- ❌ Higher risk
- ❌ Longer testing period
- ❌ All-or-nothing approach

**Recommended For:**
- Small projects (< 5 agents)
- New projects
- Non-critical systems

**Process:**
1. Week 1: Rewrite YAML configs, create tools
2. Week 2: Test all agents, fix issues, deploy

---

### Strategy 2: Phased Migration (Recommended)

**Timeline:** 4-6 weeks

Migrate agents incrementally, starting with non-critical ones.

**Pros:**
- ✅ Lower risk
- ✅ Learn from early migration
- ✅ Gradual team onboarding
- ✅ Rollback individual agents

**Cons:**
- ❌ Longer timeline
- ❌ Maintain hybrid system temporarily

**Recommended For:**
- Medium projects (5-20 agents)
- Production systems
- Teams learning API providers

**Process:**
1. Week 1-2: Migrate 1-2 non-critical agents
2. Week 3-4: Migrate medium-priority agents
3. Week 5-6: Migrate critical agents, deprecate CLI

---

### Strategy 3: Hybrid Approach (Long-term)

**Timeline:** Ongoing

Use CLI and API providers together based on use case.

**Pros:**
- ✅ Best tool for each job
- ✅ No migration pressure
- ✅ Flexible architecture

**Cons:**
- ❌ Complex configuration
- ❌ Two systems to maintain

**Recommended For:**
- Large projects (20+ agents)
- Teams with diverse use cases
- Long-term production systems

**Architecture:**
```yaml
agents:
  # CLI for local file operations
  - id: file_agent
    provider: cli/claude

  # API for HTTP-based operations
  - id: api_agent
    provider: api/anthropic
    tools: [web_search, database_query]
    mcp: [github, slack]
```

---

## Step-by-Step Migration

### Phase 1: Assessment (1-2 days)

**Goal:** Understand current system and plan migration.

**Steps:**

1. **Inventory Current Agents:**

```bash
# List all agents
crewx agent ls

# Review configurations
grep -r "provider: cli" .
```

2. **Categorize by Priority:**

- **Low Priority**: Development tools, experimental agents
- **Medium Priority**: Automation scripts, internal tools
- **High Priority**: Production services, customer-facing

3. **Identify Dependencies:**

- Which agents depend on direct file access?
- Which agents use spawn-based tools?
- Which agents can benefit from API providers?

4. **Create Migration Plan:**

```
Migration Order:
1. dev_agent (Low Priority) - Week 1
2. automation_agent (Medium Priority) - Week 2
3. production_agent (High Priority) - Week 3
```

---

### Phase 2: Setup (1 day)

**Goal:** Prepare environment for API providers.

**Steps:**

1. **Install Dependencies:**

```bash
npm install @crewx/sdk@latest zod
```

2. **Configure Environment:**

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

3. **Setup LiteLLM (Optional):**

```bash
# Install LiteLLM
pip install 'litellm[proxy]'

# Create config
cat > litellm_config.yaml <<EOF
model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: \${ANTHROPIC_API_KEY}
EOF

# Start gateway
litellm --config litellm_config.yaml
```

4. **Test Provider Availability:**

```bash
crewx doctor
```

---

### Phase 3: Migrate First Agent (2-3 days)

**Goal:** Migrate one non-critical agent as proof-of-concept.

**Before (CLI Provider):**

```yaml
# agents.yaml
agents:
  - id: dev_agent
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        You are a development assistant.
```

**After (API Provider):**

```yaml
# agents.yaml
agents:
  - id: dev_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
    inline:
      prompt: |
        You are a development assistant.
```

**Steps:**

1. **Update YAML:**

```bash
# Backup original
cp agents.yaml agents.yaml.backup

# Edit configuration
vim agents.yaml
```

2. **Test Agent:**

```bash
crewx query "@dev_agent Hello"
```

3. **Compare Responses:**

```bash
# CLI version
crewx query "@dev_agent_cli Test query"

# API version
crewx query "@dev_agent Test query"
```

4. **Document Differences:**

- Response quality
- Response time
- Any errors or issues

---

### Phase 4: Migrate Tools (3-5 days)

**Goal:** Convert spawn-based tools to function injection.

**Before (Spawn-based):**

CLI providers use spawn-based tools (e.g., file operations via CLI flags).

**After (Function Injection):**

```typescript
// tools/file-read.tool.ts
import { z } from 'zod';
import fs from 'fs/promises';

export const fileReadTool: FrameworkToolDefinition = {
  name: 'file_read',
  description: 'Read file contents',
  parameters: z.object({
    path: z.string(),
  }),
  execute: async ({ path }, context) => {
    const content = await fs.readFile(path, 'utf-8');
    return { path, content };
  },
};
```

```typescript
// index.ts
import { CrewX } from '@crewx/sdk';
import { fileReadTool } from './tools/file-read.tool';

const crewx = new CrewX({
  configPath: 'agents.yaml',
  tools: [fileReadTool],  // Inject tools
});
```

```yaml
# agents.yaml
agents:
  - id: dev_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    tools: [file_read]  # Activate tool
    inline:
      prompt: |
        You have access to file_read tool.
```

**Tool Migration Checklist:**

- [ ] List all tools used by CLI agents
- [ ] Create TypeScript tool definitions
- [ ] Inject tools in CrewX instance
- [ ] Activate tools in YAML
- [ ] Test each tool individually
- [ ] Test tools in agent context

---

### Phase 5: Add MCP Integration (2-3 days)

**Goal:** Integrate MCP servers for external tools.

**Setup GitHub MCP:**

```yaml
# agents.yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

agents:
  - id: dev_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    mcp: [github]  # Activate MCP
    tools: [file_read]  # Plus custom tools
    inline:
      prompt: |
        You have access to:
        - GitHub tools (via MCP)
        - file_read (custom tool)
```

**Test MCP:**

```bash
crewx execute "@dev_agent Search GitHub for machine learning repos"
```

---

### Phase 6: Production Deployment (3-5 days)

**Goal:** Deploy migrated agents to production.

**Steps:**

1. **Run Integration Tests:**

```bash
npm test
```

2. **Performance Testing:**

```bash
# Test response times
time crewx query "@dev_agent Test query"
```

3. **Load Testing (if applicable):**

```bash
# Concurrent requests
for i in {1..10}; do
  crewx query "@dev_agent Test $i" &
done
wait
```

4. **Deploy to Production:**

```bash
# Build
npm run build

# Deploy
npm run deploy
```

5. **Monitor:**

- Error rates
- Response times
- Tool execution success rates
- Cost (API usage)

---

## Configuration Changes

### Environment Variables

**Before (CLI Provider):**

```bash
# No API keys needed (uses local CLI)
```

**After (API Provider):**

```bash
# API keys required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### YAML Configuration

**Before:**

```yaml
agents:
  - id: my_agent
    provider: cli/claude
    inline:
      model: sonnet  # CLI model name
      prompt: |
        You are an assistant.
```

**After:**

```yaml
agents:
  - id: my_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022  # API model name
    temperature: 0.7
    maxTokens: 2000
    tools: [tool1, tool2]  # Tool activation
    mcp: [github, slack]   # MCP activation
    inline:
      prompt: |
        You are an assistant.
```

### Model Name Mapping

| CLI Model | API Model |
|-----------|-----------|
| `sonnet` | `claude-3-5-sonnet-20241022` |
| `opus` | `claude-3-opus-20240229` |
| `haiku` | `claude-3-haiku-20240307` |
| `gemini-pro` | `gemini-1.5-pro` |
| `gemini-flash` | `gemini-1.5-flash` |

---

## Provider Options Migration

### Understanding Provider Options

Provider Options is a new feature that provides mode-specific configuration for API providers, allowing different tool and MCP access for query vs execute modes.

### Migration Patterns

#### Pattern 1: Legacy Tools Array → Provider Options

**Before (Legacy CLI/Early API):**

```yaml
agents:
  - id: my_agent
    provider: api/anthropic
    tools: [file_read, file_write, grep]      # Root-level tools
    mcp_servers: [filesystem, github]         # Root-level MCP
```

**After (Provider Options):**

```yaml
agents:
  - id: my_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:                     # Read-only mode
        tools: [file_read, grep]  # Safe tools only
        mcp: [filesystem]         # Read-only access
      execute:                   # Write mode
        tools: [file_read, file_write, grep]  # Full tools
        mcp: [filesystem, github]             # Full MCP access
```

#### Pattern 2: Security-First Migration

**Before (Overly Permissive):**

```yaml
agents:
  - id: production_agent
    provider: api/anthropic
    tools: [file_read, file_write, run_shell, deploy]
    mcp_servers: [github, kubernetes, docker]
```

**After (Secure by Default):**

```yaml
agents:
  - id: production_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:                     # Analysis mode
        tools: [file_read, grep]  # Read-only tools
        mcp: [github]             # Read-only GitHub
      execute:                   # Modification mode
        tools: [file_read, file_write, deploy]  # Write tools
        mcp: [github, kubernetes]               # Infrastructure MCP
```

#### Pattern 3: Hybrid CLI → API Migration

**During Migration (Both Providers Active):**

```yaml
agents:
  # Keep CLI agent for file operations
  - id: file_manager_cli
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        File system manager (CLI)

  # New API agent with restricted access
  - id: api_agent_secure
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [web_search, company_info]      # API-based tools
        mcp: [github_read]                      # Read-only GitHub
      execute:
        tools: [web_search, company_info, notify]  # Plus write tools
        mcp: [github_read, slack]                  # Plus Slack notifications
```

### Automatic Legacy Conversion

CrewX automatically converts legacy formats to Provider Options:

**Input (Legacy):**
```yaml
agents:
  - name: legacy_agent
    provider: api/anthropic
    tools: [file_read, file_write]
    mcp_servers: [filesystem]
```

**Auto-converted:**
```yaml
agents:
  - name: legacy_agent
    provider: api/anthropic
    options:
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem]
```

**Note**: Auto-conversion defaults to execute mode only for backward compatibility.

### Migration Steps for Provider Options

#### Step 1: Audit Current Tool Usage

```bash
# Find agents with legacy configuration
grep -r "tools:" agents.yaml
grep -r "mcp_servers:" agents.yaml

# Identify tool usage patterns
grep -r "file_" agents.yaml
grep -r "deploy" agents.yaml
grep -r "git" agents.yaml
```

#### Step 2: Categorize Tools by Mode

**Query Mode Tools (Read-Only):**
- `file_read`, `grep`, `glob` - File system reading
- `web_search`, `company_info` - External data lookup
- `status_check`, `monitor` - System monitoring

**Execute Mode Tools (Read/Write):**
- `file_write`, `run_shell` - File system writing
- `deploy_service`, `restart_service` - Infrastructure changes
- `create_issue`, `send_notification` - External system writes

#### Step 3: Plan Security Model

**Example Migration Plan:**

| Agent Type | Query Tools | Execute Tools | Security Level |
|------------|-------------|---------------|----------------|
| Researcher | web_search, file_read | (none) | High |
| Developer | file_read, grep | file_write, git | Medium |
| DevOps | status_check | deploy, restart | Low |

#### Step 4: Implement Provider Options

**Before (Legacy):**
```yaml
agents:
  - id: dev_assistant
    provider: api/anthropic
    tools: [file_read, file_write, grep, git]
    mcp_servers: [github, filesystem]
```

**After (Provider Options):**
```yaml
agents:
  - id: dev_assistant
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [file_read, grep]          # Code analysis
        mcp: [github]                      # Read GitHub data
      execute:
        tools: [file_read, file_write, git]  # Full development
        mcp: [github, filesystem]              # Write access
```

### Best Practices for Provider Options Migration

#### 1. Start Conservative

```yaml
# ✅ Good: Start restrictive, expand later
options:
  query:
    tools: [file_read]          # Minimal tools
    mcp: []                     # No MCP initially
  execute:
    tools: [file_read, file_write]  # Core tools only
    mcp: [filesystem]                 # Essential MCP only

# After testing, add more:
# query.tools: [file_read, grep, search]
# execute.mcp: [github, docker]
```

#### 2. Test Mode Behavior

```bash
# Test query mode (should fail on writes)
echo "Test file" > /tmp/test.txt
crewx query "@agent delete /tmp/test.txt"

# Test execute mode (should succeed)
crewx execute "@agent delete /tmp/test.txt"
```

#### 3. Document Security Model

```yaml
agents:
  - id: production_bot
    name: Production Assistant
    notes: |
      Security Model:
      - Query: Read-only analysis (safe for all users)
      - Execute: Infrastructure changes (admin approval required)
    options:
      query:
        tools: [status_check, log_read]
        mcp: [monitoring_read]
      execute:
        tools: [deploy, restart, configure]
        mcp: [kubernetes, docker]
```

### Common Migration Patterns

#### Pattern A: Research-Only Agent

**Use Case**: Market research, code analysis, documentation review

```yaml
agents:
  - id: research_analyst
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [web_search, company_info, file_read, grep]
        mcp: [github_read, database_read]
      execute:
        tools: []                  # No write operations
        mcp: []                    # No write access
```

#### Pattern B: Development Assistant

**Use Case**: Code review, file editing, git operations

```yaml
agents:
  - id: code_assistant
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [file_read, grep, search, analyze]
        mcp: [github_read]
      execute:
        tools: [file_read, file_write, git, test_run]
        mcp: [github_write, filesystem]
```

#### Pattern C: DevOps Engineer

**Use Case**: Infrastructure management, deployment, monitoring

```yaml
agents:
  - id: devops_engineer
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [status_check, log_read, health_check]
        mcp: [kubernetes_read, monitoring_read]
      execute:
        tools: [deploy_service, restart_service, configure]
        mcp: [kubernetes, docker, aws]
```

### Troubleshooting Provider Options Migration

#### Issue: Tools Not Available in Query Mode

**Problem**: Agent can't perform operations in query mode

**Solution**: 
```yaml
# Check if tools are in wrong mode
options:
  query:
    tools: []                  # Empty = no tools
  execute:
    tools: [file_read]         # Only in execute mode

# Fix: Move read tools to query mode
options:
  query:
    tools: [file_read]         # Now available in query
  execute:
    tools: [file_read, file_write]
```

#### Issue: Legacy Format Not Converting

**Problem**: `tools: [...]` not being converted to Provider Options

**Solution**:
```bash
# Enable debug logging to see conversion
DEBUG=crewx:* crewx query "@agent test"

# Manually convert for clarity
# Change: tools: [file_read, file_write]
# To: options.execute.tools: [file_read, file_write]
```

#### Issue: Mode Confusion

**Problem**: Agent behaves differently than expected

**Solution**:
```bash
# Test both modes explicitly
echo "test content" > /tmp/test.txt

# Query mode (read-only)
crewx query "@agent read /tmp/test.txt"      # Should work
crewx query "@agent modify /tmp/test.txt"    # Should fail/warn

# Execute mode (read/write)
crewx execute "@agent read /tmp/test.txt"    # Should work
crewx execute "@agent modify /tmp/test.txt"  # Should work
```

---

## Provider Options Migration

### Understanding Provider Options

Provider Options is a new feature that provides mode-specific configuration for API providers, allowing different tool and MCP access for query vs execute modes.

### Migration Patterns

#### Pattern 1: Legacy Tools Array → Provider Options

**Before (Legacy CLI/Early API):**

```yaml
agents:
  - id: my_agent
    provider: api/anthropic
    tools: [file_read, file_write, grep]      # Root-level tools
    mcp_servers: [filesystem, github]         # Root-level MCP
```

**After (Provider Options):**

```yaml
agents:
  - id: my_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:                     # Read-only mode
        tools: [file_read, grep]  # Safe tools only
        mcp: [filesystem]         # Read-only access
      execute:                   # Write mode
        tools: [file_read, file_write, grep]  # Full tools
        mcp: [filesystem, github]             # Full MCP access
```

#### Pattern 2: Security-First Migration

**Before (Overly Permissive):**

```yaml
agents:
  - id: production_agent
    provider: api/anthropic
    tools: [file_read, file_write, run_shell, deploy]
    mcp_servers: [github, kubernetes, docker]
```

**After (Secure by Default):**

```yaml
agents:
  - id: production_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:                     # Analysis mode
        tools: [file_read, grep]  # Read-only tools
        mcp: [github]             # Read-only GitHub
      execute:                   # Modification mode
        tools: [file_read, file_write, deploy]  # Write tools
        mcp: [github, kubernetes]               # Infrastructure MCP
```

#### Pattern 3: Hybrid CLI → API Migration

**During Migration (Both Providers Active):**

```yaml
agents:
  # Keep CLI agent for file operations
  - id: file_manager_cli
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        File system manager (CLI)

  # New API agent with restricted access
  - id: api_agent_secure
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    options:
      query:
        tools: [web_search, company_info]      # API-based tools
        mcp: [github_read]                      # Read-only GitHub
      execute:
        tools: [web_search, company_info, notify]  # Plus write tools
        mcp: [github_read, slack]                  # Plus Slack notifications
```

### Automatic Legacy Conversion

CrewX automatically converts legacy formats to Provider Options:

**Input (Legacy):**
```yaml
agents:
  - name: legacy_agent
    provider: api/anthropic
    tools: [file_read, file_write]
    mcp_servers: [filesystem]
```

**Auto-converted:**
```yaml
agents:
  - name: legacy_agent
    provider: api/anthropic
    options:
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem]
```

**Note**: Auto-conversion defaults to execute mode only for backward compatibility.

---

## Tool Migration

### CLI Tools → Function Injection

**Conceptual Difference:**

- **CLI Provider**: Tools executed via spawn flags (e.g., file operations)
- **API Provider**: Tools defined in TypeScript and injected

**Migration Pattern:**

1. **Identify CLI Tool Usage:**

```yaml
# Before (implicit file access)
provider: cli/claude
# Agent has direct file access via spawn
```

2. **Create Tool Definition:**

```typescript
// tools/file-read.tool.ts
export const fileReadTool: FrameworkToolDefinition = {
  name: 'file_read',
  description: 'Read file contents',
  parameters: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    return await fs.readFile(path, 'utf-8');
  },
};
```

3. **Inject and Activate:**

```typescript
// index.ts
const crewx = new CrewX({
  configPath: 'agents.yaml',
  tools: [fileReadTool],  // Inject
});
```

```yaml
# agents.yaml
agents:
  - id: my_agent
    provider: api/anthropic
    tools: [file_read]  # Activate
```

### Tool Context Access

API provider tools get rich context:

```typescript
execute: async (args, context) => {
  // Agent info
  console.log(`Agent: ${context.agent.id}`);

  // Environment variables
  const apiKey = context.env.API_KEY;

  // Custom variables from YAML
  const companyName = context.vars?.companyName;

  // Execution mode
  if (context.mode === 'execute') {
    // Write operations
  }
}
```

---

## Testing & Validation

### Test Plan

**1. Functional Testing:**

```bash
# Test each agent
crewx query "@agent1 test query"
crewx query "@agent2 test query"

# Test tool calling
crewx execute "@agent1 Use tool X to do Y"

# Test MCP integration
crewx execute "@agent1 Create GitHub issue: Test"
```

**2. Performance Testing:**

```bash
# Response time
time crewx query "@agent test"

# Concurrent requests
for i in {1..10}; do
  crewx query "@agent test $i" &
done
wait
```

**3. Error Handling:**

```bash
# Invalid input
crewx query "@agent <invalid input>"

# Missing API key
unset OPENAI_API_KEY
crewx query "@agent test"

# Network issues
# (Disconnect network and test)
```

**4. Cost Analysis:**

```bash
# Monitor API usage
# Check provider dashboard for token usage
# Compare costs: CLI (free local) vs API (paid)
```

### Regression Testing

Ensure existing functionality works:

```bash
# Run existing test suite
npm test

# Manual smoke tests
crewx query "@agent1 <known query>"
crewx execute "@agent2 <known task>"
```

---

## Rollback Plan

### Preparation

**1. Backup Configuration:**

```bash
cp agents.yaml agents.yaml.backup
cp .env .env.backup
git commit -am "Backup before API provider migration"
```

**2. Keep CLI Agents:**

```yaml
agents:
  # New API agent
  - id: my_agent
    provider: api/anthropic
    # ...

  # Old CLI agent (backup)
  - id: my_agent_cli_backup
    provider: cli/claude
    # ...
```

### Rollback Steps

**If migration fails:**

1. **Restore Configuration:**

```bash
cp agents.yaml.backup agents.yaml
cp .env.backup .env
```

2. **Redeploy:**

```bash
npm run deploy
```

3. **Verify:**

```bash
crewx doctor
crewx query "@my_agent_cli_backup test"
```

### Gradual Rollback

If only some agents fail, roll back incrementally:

```yaml
agents:
  # Keep working API agents
  - id: working_agent
    provider: api/anthropic

  # Rollback failed agents to CLI
  - id: failed_agent
    provider: cli/claude  # Restore CLI
```

---

## FAQ

### General Questions

**Q: Do I need to migrate all agents at once?**

A: No. Phased migration is recommended. You can run CLI and API providers side-by-side.

**Q: Will API providers cost more than CLI providers?**

A: Yes. CLI providers use local tools (free), while API providers call cloud APIs (paid). However, API providers offer better scalability and features.

**Q: Can I use the same model with API provider?**

A: Yes, but model names differ:
- CLI: `sonnet` → API: `claude-3-5-sonnet-20241022`

**Q: Do API providers support streaming?**

A: Yes, via HTTP Server-Sent Events (SSE).

---

### Migration Questions

**Q: How long does migration take?**

A:
- Simple agent: 1-2 hours
- Agent with tools: 1-2 days
- Full project: 4-6 weeks (phased approach)

**Q: Can I migrate just one agent first?**

A: Yes, this is the recommended approach. Migrate non-critical agents first to learn the process.

**Q: What if my agent needs file system access?**

A: Create file operation tools:

```typescript
// tools/file-ops.ts
export const fileReadTool = { /* ... */ };
export const fileWriteTool = { /* ... */ };
```

Or use Filesystem MCP server:

```yaml
mcp_servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
```

---

### Technical Questions

**Q: How do I handle tool migration?**

A: Convert spawn-based tools to function injection:

**Before (CLI):**
- Spawn process with file access flags

**After (API):**
```typescript
const fileTool: FrameworkToolDefinition = {
  name: 'file_read',
  execute: async ({ path }) => fs.readFile(path, 'utf-8'),
};
```

**Q: Can API agents access local files?**

A: Yes, via tools (function injection) or Filesystem MCP server. Not directly.

**Q: How do I debug API provider issues?**

A:
```bash
# Enable debug logging
export DEBUG=crewx:*

# Check provider status
crewx doctor

# Test tool independently
npm test
```

**Q: What about mode distinction (query vs execute)?**

A: API providers don't distinguish at provider level. Both call the same HTTP endpoint. Mode is handled at CLI/SDK layer.

---

### Cost & Performance Questions

**Q: How much will API providers cost?**

A: Depends on usage:
- **OpenAI GPT-4**: ~$0.03/1K tokens (input), ~$0.06/1K tokens (output)
- **Anthropic Claude**: ~$0.003/1K tokens (Haiku), ~$0.03/1K tokens (Opus)
- **Google Gemini**: ~$0.00025/1K tokens (Flash)

Use LiteLLM for cost optimization.

**Q: Are API providers faster than CLI providers?**

A: Generally yes. HTTP calls are faster than process spawning. However, network latency affects speed.

**Q: Can I reduce costs with LiteLLM?**

A: Yes. LiteLLM supports:
- Cost-based routing (use cheapest model)
- Caching (reduce duplicate requests)
- Load balancing (distribute across keys)

---

### Troubleshooting Questions

**Q: My agent doesn't see tools. Why?**

A: Check:
1. Tools are injected: `CrewX({ tools: [...] })`
2. Tools are activated: `agents[].tools: [...]`
3. Tool names match

**Q: MCP server not connecting. Help?**

A:
```bash
# Test server independently
npx -y @modelcontextprotocol/server-github

# Check environment variables
echo $GITHUB_TOKEN

# Enable debug mode
export DEBUG=mcp:*
```

**Q: Agent responses are different. Why?**

A: API models may behave differently than CLI models:
- Temperature settings affect randomness
- Prompt formatting may differ
- Model versions may have changed

Adjust temperature and prompt to match behavior.

---

## Support & Resources

### Documentation

- [API Provider Reference](./api-provider-reference.md)
- [API Provider User Guide](./api-provider-guide.md)
- [Examples](../examples/)

### Community

- GitHub Issues: https://github.com/sowonai/crewx/issues
- Discord: https://discord.gg/crewx
- Documentation: https://crewx.dev/docs

### Getting Help

**1. Check Documentation:**
- Read API Provider Reference
- Review examples
- Check FAQ

**2. Enable Debug Mode:**
```bash
export DEBUG=crewx:*
crewx doctor
```

**3. Create GitHub Issue:**
- Include config files (remove secrets)
- Include error logs
- Describe expected vs actual behavior

---

## Conclusion

Migrating from CLI to API providers is a structured process that can be done incrementally. Start with non-critical agents, learn from the experience, and gradually migrate your entire system.

**Key Takeaways:**

- ✅ Phased migration is safest (4-6 weeks)
- ✅ API providers offer better scalability and features
- ✅ Function injection replaces spawn-based tools
- ✅ MCP integration adds powerful external tools
- ✅ Hybrid approach is valid long-term

**Next Steps:**

1. Read [API Provider User Guide](./api-provider-guide.md)
2. Try [Basic Example](../examples/api-agent-basic/)
3. Plan your migration strategy
4. Start with one non-critical agent

Good luck with your migration! 🚀

---

**End of Migration Guide**
