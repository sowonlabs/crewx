# Test Fixtures for CrewX SDK

## Agent Configuration Samples

### Basic Agent Config
```yaml
agents:
  backend:
    provider: cli/claude
    description: Backend development specialist
    inline:
      model: claude-3-opus
      temperature: 0.7
```

### Multi-Agent Config
```yaml
agents:
  frontend:
    provider: cli/copilot
    description: Frontend development
    inline:
      model: gpt-4
      temperature: 0.5
  backend:
    provider: cli/claude
    description: Backend development
    inline:
      model: claude-3-opus
      temperature: 0.7
  devops:
    provider: cli/gemini
    description: DevOps automation
    inline:
      model: gemini-pro
      temperature: 0.3
```

## Message Samples

### Basic Conversation Message
```json
{
  "id": "msg-001",
  "userId": "user123",
  "text": "Hello, how are you?",
  "timestamp": "2025-01-16T10:00:00.000Z",
  "isAssistant": false
}
```

### Assistant Message
```json
{
  "id": "msg-002",
  "userId": "crewx",
  "text": "I'm doing well, thank you!",
  "timestamp": "2025-01-16T10:00:01.000Z",
  "isAssistant": true,
  "metadata": {
    "agentId": "claude"
  }
}
```

## Provider Test Data

### Claude Provider Response
```json
{
  "content": "This is a test response from Claude",
  "model": "claude-3-opus",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 5
  }
}
```

### Copilot Provider Response
```json
{
  "content": "This is a test response from Copilot",
  "model": "gpt-4",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5
  }
}
```

### Gemini Provider Response
```json
{
  "content": "This is a test response from Gemini",
  "model": "gemini-pro",
  "usage": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 5
  }
}
```