# Test Fixtures for CrewX CLI

## Command Test Samples

### Basic Query Command
```bash
crewx query "@claude review this code"
```

### Execute Command
```bash
crewx execute "@copilot implement user authentication"
```

### Help Command
```bash
crewx help
```

## Integration Test Data

### Slack Message Event
```json
{
  "type": "message",
  "channel": "C1234567890",
  "user": "U1234567890",
  "text": "@crewx help me with this bug",
  "ts": "1642245600.000100",
  "event_ts": "1642245600.000100"
}
```

### Slack App Mention Event
```json
{
  "type": "app_mention",
  "channel": "C1234567890",
  "user": "U1234567890",
  "text": "<@U0123456789> review this PR",
  "ts": "1642245600.000200",
  "event_ts": "1642245600.000200"
}
```

## MCP Test Data

### Tool Call Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query",
    "arguments": {
      "prompt": "test query",
      "agentId": "claude"
    }
  }
}
```

### Tool Call Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Test response from CrewX"
      }
    ],
    "isError": false
  }
}
```

## Error Scenarios

### Invalid Agent Error
```json
{
  "error": "Agent not found: @invalid_agent"
}
```

### Provider Error
```json
{
  "error": "Provider error: API rate limit exceeded"
}
```

### Configuration Error
```json
{
  "error": "Configuration error: Invalid YAML syntax"
}
```