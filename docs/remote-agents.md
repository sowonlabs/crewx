# Remote Agents

Connect CrewX to other CrewX instances for distributed collaboration and resource sharing.

## Overview

Remote agents allow you to:
- **Delegate tasks** to CrewX instances running in different projects
- **Share resources** across teams and servers
- **Isolate contexts** for different codebases
- **Scale workloads** by distributing to remote servers

## Quick Start

### 1. Start a Remote MCP Server

```bash
# Start CrewX as an MCP server with HTTP and authentication
crewx mcp server --http --host localhost --port 9001 --key "sk-secret-key" --log
```

**Options:**
- `--http` - Enable HTTP transport (in addition to stdio)
- `--host` - Server hostname (default: localhost)
- `--port` - Server port (default: 3000)
- `--key` - API key for bearer authentication
- `--log` - Enable request logging

### 2. Configure Remote Provider

Add to your local `crewx.yaml`:

```yaml
providers:
  - id: remote_server
    type: remote
    location: "http://localhost:9001"
    external_agent_id: "backend_team"
    display_name: "Backend Server"
    description: "Remote CrewX instance for backend tasks"
    auth:
      type: bearer
      token: "sk-secret-key"
    timeout:
      query: 300000    # 5 minutes
      execute: 600000  # 10 minutes

agents:
  - id: "remote_backend"
    name: "Backend Team"
    provider: "remote/remote_server"
    description: "Backend development team on remote server"
```

### 3. Use Remote Agent

```bash
# Query remote agent
crewx query "@remote_backend check API status"

# Execute tasks on remote agent
crewx execute "@remote_backend implement new endpoint"

# Combine with local agents
crewx query "@claude @remote_backend compare approaches"
```

## Configuration

### Provider Configuration

```yaml
providers:
  - id: unique_provider_id
    type: remote
    location: "http://hostname:port" or "file:///absolute/path/to/config.yaml"
    external_agent_id: "target_agent_id_on_remote"
    display_name: "Human Readable Name"
    description: "Provider description"
    auth:                    # Optional
      type: bearer
      token: "your-token"
    headers:                 # Optional custom headers
      "User-Agent": "CrewX/1.0"
      "X-Client-ID": "client-123"
    timeout:
      query: 300000         # Milliseconds (default: 5 min)
      execute: 600000       # Milliseconds (default: 10 min)
```

### Agent Configuration

```yaml
agents:
  - id: "local_agent_id"
    name: "Display Name"
    provider: "remote/provider_id"
    description: "Agent description"
    working_directory: "/path/to/workdir"  # Optional
```

## Connection Types

### HTTP-based Remote Server

Most common for network-based remote connections.

**Remote server setup:**
```bash
# On the remote server (192.168.1.100)
cd /path/to/project
crewx mcp server --http --host 0.0.0.0 --port 3000 --key "production-key"
```

**Local configuration:**
```yaml
providers:
  - id: production_server
    type: remote
    location: "http://192.168.1.100:3000"
    external_agent_id: "prod_backend"
    auth:
      type: bearer
      token: "production-key"
    timeout:
      query: 180000
      execute: 600000
```

### File-based Local Remote

Access another local CrewX configuration without starting a server.

**Use case:** Multi-project coordination on the same machine.

```yaml
providers:
  - id: other_project
    type: remote
    location: "file:///Users/username/projects/other-project/crewx.yaml"
    external_agent_id: "specialist_agent"
    timeout:
      query: 300000
      execute: 600000

agents:
  - id: "other_project_team"
    provider: "remote/other_project"
```

**Example usage:**
```bash
# Current project: main application
# Remote project: data processing pipeline

crewx execute "@other_project_team process new dataset"
```

## Use Cases

### Multi-Project Coordination

Coordinate work across multiple repositories:

```yaml
# In main project's crewx.yaml
providers:
  - id: frontend_project
    type: remote
    location: "file:///workspace/frontend-app/crewx.yaml"
    external_agent_id: "react_specialist"

  - id: backend_project
    type: remote
    location: "file:///workspace/backend-api/crewx.yaml"
    external_agent_id: "api_specialist"

agents:
  - id: "frontend_team"
    provider: "remote/frontend_project"

  - id: "backend_team"
    provider: "remote/backend_project"

  - id: "coordinator"
    inline:
      provider: "cli/claude"
      prompt: |
        You coordinate between frontend and backend teams.
        Use @frontend_team for React/UI tasks.
        Use @backend_team for API/database tasks.
```

**Usage:**
```bash
# Coordinate full-stack feature
crewx query "@coordinator plan user authentication feature"
crewx execute "@frontend_team create login UI" "@backend_team create auth API"
```

### Distributed Team Setup

Each team member runs their own CrewX with specialized configurations:

**Team Lead's configuration:**
```yaml
providers:
  - id: alice_workstation
    type: remote
    location: "http://alice.local:3000"
    external_agent_id: "alice_specialist"
    auth:
      type: bearer
      token: "alice-key"

  - id: bob_workstation
    type: remote
    location: "http://bob.local:3000"
    external_agent_id: "bob_specialist"
    auth:
      type: bearer
      token: "bob-key"

agents:
  - id: "alice"
    provider: "remote/alice_workstation"
    description: "Alice's specialized AI setup (ML focus)"

  - id: "bob"
    provider: "remote/bob_workstation"
    description: "Bob's specialized AI setup (DevOps focus)"
```

### Resource Sharing

Access powerful compute resources from lightweight clients:

```yaml
# Laptop configuration
providers:
  - id: gpu_server
    type: remote
    location: "http://gpu-server.company.com:3000"
    external_agent_id: "ml_trainer"
    auth:
      type: bearer
      token: "${ML_SERVER_TOKEN}"  # Use environment variable
    timeout:
      query: 600000    # 10 min for ML tasks
      execute: 1800000 # 30 min for training

agents:
  - id: "ml_server"
    provider: "remote/gpu_server"
    description: "High-performance ML agent on GPU server"
```

## Environment Variables

Use environment variables for sensitive configuration:

```yaml
providers:
  - id: prod_server
    type: remote
    location: "${CREWX_REMOTE_URL}"
    external_agent_id: "${CREWX_REMOTE_AGENT}"
    auth:
      type: bearer
      token: "${CREWX_REMOTE_TOKEN}"
```

**.env file:**
```bash
CREWX_REMOTE_URL=http://production.example.com:3000
CREWX_REMOTE_AGENT=backend_prod
CREWX_REMOTE_TOKEN=sk-prod-secret-key
```

## Authentication

### Bearer Token Authentication

Most common method for HTTP remote servers.

**Server side:**
```bash
crewx mcp server --http --port 3000 --key "sk-production-key-123"
```

**Client side:**
```yaml
providers:
  - id: secure_server
    type: remote
    location: "http://server:3000"
    external_agent_id: "agent"
    auth:
      type: bearer
      token: "sk-production-key-123"
```

The token is sent as: `Authorization: Bearer sk-production-key-123`

### Custom Headers

Add additional headers for advanced authentication or routing:

```yaml
providers:
  - id: enterprise_server
    type: remote
    location: "http://api.company.com:3000"
    external_agent_id: "agent"
    auth:
      type: bearer
      token: "jwt-token-here"
    headers:
      "X-Tenant-ID": "company-123"
      "X-Environment": "production"
      "User-Agent": "CrewX/1.0"
```

## Timeouts

Configure appropriate timeouts based on task complexity and network conditions:

```yaml
providers:
  - id: slow_network
    type: remote
    location: "http://remote:3000"
    external_agent_id: "agent"
    timeout:
      query: 600000    # 10 minutes (slow network + complex query)
      execute: 1800000 # 30 minutes (network + file operations)
```

**Recommended timeouts:**
- **Local network**: query 60-120s, execute 180-300s
- **Internet**: query 180-300s, execute 600-900s
- **Complex tasks**: query 300-600s, execute 900-1800s

## Limitations

### Current Limitations

1. **Stateless calls**
   - `--thread` conversation history is NOT forwarded to remote server
   - Each remote call is independent
   - Solution: Use remote server's own thread management

2. **MCP tool requirements**
   - Remote server must expose `crewx_queryAgent` and `crewx_executeAgent` tools
   - Standard CrewX MCP server includes these automatically

3. **Network considerations**
   - Higher latency than local agents
   - Configure timeouts appropriately
   - Consider task granularity

### Workarounds

**For conversation continuity:**
```bash
# Don't use --thread across remote boundaries
# Instead, use remote server's thread locally

# On remote server
crewx query "@agent design API" --thread "project"
crewx execute "@agent implement it" --thread "project"

# From client (each call is independent)
crewx query "@remote_agent task description with full context"
```

**For long-running tasks:**
```yaml
# Increase timeout for complex operations
providers:
  - id: slow_tasks
    type: remote
    location: "http://server:3000"
    external_agent_id: "agent"
    timeout:
      execute: 3600000  # 1 hour
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to remote server

```bash
# Test network connectivity
curl http://remote-host:3000/health

# Check server logs
crewx mcp server --http --port 3000 --log
```

**Solution:**
- Verify server is running: `crewx mcp server --http`
- Check firewall rules
- Verify hostname/port in configuration
- Test with curl first

### Authentication Failures

**Problem:** 401 Unauthorized

**Solution:**
- Verify token matches between client and server
- Check token is correctly set in config
- Ensure `auth.type` is set to `bearer`

### Timeout Errors

**Problem:** Task times out

**Solution:**
- Increase timeout values in provider config
- Check network latency: `ping remote-host`
- Split large tasks into smaller chunks

### Agent Not Found

**Problem:** Remote agent ID doesn't exist

**Solution:**
- List available agents on remote: `crewx mcp server --list`
- Verify `external_agent_id` matches remote agent ID
- Check remote server's `crewx.yaml` configuration

## Best Practices

1. **Security**
   - Use strong API keys (min 16 characters)
   - Store tokens in environment variables, not in config files
   - Use HTTPS for remote connections in production
   - Rotate tokens regularly

2. **Performance**
   - Use remote agents for specialized tasks, not everything
   - Consider network latency in workflow design
   - Set realistic timeouts
   - Monitor remote server resource usage

3. **Organization**
   - Use clear, descriptive agent IDs
   - Document what each remote agent does
   - Version control your remote configurations
   - Keep remote server configs synchronized

4. **Reliability**
   - Implement health checks
   - Have fallback local agents
   - Log remote calls for debugging
   - Monitor remote server availability

## Examples

### Example 1: Development → Staging → Production

```yaml
# development.crewx.yaml
providers:
  - id: staging_server
    type: remote
    location: "http://staging.company.com:3000"
    external_agent_id: "staging_tester"
    auth:
      type: bearer
      token: "${STAGING_TOKEN}"

  - id: prod_server
    type: remote
    location: "http://prod.company.com:3000"
    external_agent_id: "prod_deployer"
    auth:
      type: bearer
      token: "${PROD_TOKEN}"

agents:
  - id: "dev_agent"
    provider: "cli/claude"
    working_directory: "./src"

  - id: "staging_agent"
    provider: "remote/staging_server"

  - id: "prod_agent"
    provider: "remote/prod_server"
```

**Workflow:**
```bash
# Develop locally
crewx execute "@dev_agent implement feature"

# Test on staging
crewx query "@staging_agent run integration tests"

# Deploy to production
crewx execute "@prod_agent deploy version 1.2.3"
```

### Example 2: Specialized Domain Experts

```yaml
providers:
  - id: ml_server
    type: remote
    location: "http://ml-gpu.local:3000"
    external_agent_id: "ml_expert"

  - id: security_server
    type: remote
    location: "http://security.local:3000"
    external_agent_id: "security_expert"

agents:
  - id: "ml_specialist"
    provider: "remote/ml_server"
    description: "ML/AI expert with GPU access"

  - id: "security_specialist"
    provider: "remote/security_server"
    description: "Security analysis expert"

  - id: "architect"
    inline:
      provider: "cli/claude"
      prompt: |
        You're the system architect. Coordinate with specialists:
        - @ml_specialist for ML/AI questions
        - @security_specialist for security reviews
```

**Usage:**
```bash
# Architect coordinates specialists
crewx query "@architect design user recommendation system"
# → Architect consults @ml_specialist for ML design

crewx query "@architect review authentication code"
# → Architect consults @security_specialist for security review
```

## See Also

- [Agent Configuration](./agent-configuration.md) - General agent setup
- [MCP Integration](./mcp-integration.md) - MCP server configuration
- [CLI Guide](./cli-guide.md) - Command-line reference
