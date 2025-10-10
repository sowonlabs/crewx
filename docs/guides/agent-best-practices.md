# Agent Best Practices

Guidelines for creating effective AI agents in CrewX.

## Agent Specialization

Each agent should have a clear, focused purpose:

- **@claude** - Complex reasoning, architecture decisions
- **@copilot** - Code implementation, best practices
- **@gemini** - Performance optimization, data analysis

## System Prompt Design

### Be Specific

Good:
```yaml
system_prompt: |
  You are a TypeScript expert specializing in NestJS applications.
  Focus on type safety, dependency injection, and testing.
```

Bad:
```yaml
system_prompt: |
  You are a helpful assistant.
```

### Provide Context

Include relevant documentation, coding standards, or project-specific guidelines in your system prompt.

### Use Document References

Reference documents instead of duplicating content:

```yaml
system_prompt: |
  You are a senior developer.
  
  <coding-standards>
  {{{documents.coding-standards.content}}}
  </coding-standards>
```

## Model Selection

Choose the right model for your task:

- `sonnet` - Balanced performance (recommended)
- `opus` - Complex reasoning tasks
- `haiku` - Fast, simple tasks

Specify the model in your query:
```bash
crewx q "@claude:opus design this architecture"
```

## Parallel Execution

Leverage parallel execution for independent tasks:

```bash
# Good - parallel analysis
crewx q "@claude @copilot @gemini review this code"

# Bad - sequential when parallel is possible
crewx q "@claude review this code"
crewx q "@copilot review this code"
crewx q "@gemini review this code"
```

## Task Breakdown

Break complex tasks into agent-specific subtasks:

```bash
# Architecture
crewx q "@claude design user authentication system"

# Implementation  
crewx x "@copilot implement JWT middleware"

# Optimization
crewx q "@gemini optimize authentication performance"
```

## Error Handling

Check task logs when things go wrong:

```bash
crewx logs [taskId]
```

Review agent responses for warnings or suggestions.
