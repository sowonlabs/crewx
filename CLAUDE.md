# CrewX Slack Thread History Project

## Project Overview
This is a CrewX project focused on implementing enhanced conversation history management with Slack thread integration and CLI chat functionality.

## Key Architecture Points
- **NestJS Framework**: Service-oriented architecture with dependency injection
- **Multi-AI Provider Integration**: Claude, Gemini, and Copilot provider support
- **Conversation History System**: Pluggable provider pattern for different platforms
- **Slack Integration**: Thread-aware conversation management
- **Enhanced Context Management**: Intelligent compression and project memory

## Recent Enhancements
- **Claude Agent SDK Integration**: Added intelligent context compression and project memory features
- **Context Enhancement Service**: Automatic CLAUDE.md file detection and loading
- **Intelligent Compression Service**: Advanced conversation history compression with importance detection
- **CLI Options Extension**: Added --load-project-context and related options

## Coding Conventions
- Use NestJS dependency injection patterns throughout
- Follow SOLID principles for service design
- Implement comprehensive error handling with typed exceptions
- Write unit and integration tests for all new features
- Maintain backward compatibility with existing CLI interfaces

## Important Files and Directories
- `src/services/context-enhancement.service.ts`: Project context loading and enhancement
- `src/services/intelligent-compression.service.ts`: Advanced conversation compression
- `src/conversation/`: Conversation history management framework
- `src/providers/`: AI provider implementations
- `src/cli/`: CLI command handlers
- `agents.yaml`: Agent configuration and capabilities

## Development Guidelines
- **TypeScript Strict Mode**: All code uses strict typing
- **Service Pattern**: Business logic encapsulated in injectable services
- **Provider Pattern**: Extensible architecture for new platform integrations
- **Test Coverage**: Comprehensive testing with Vitest framework

## Current Focus Areas
1. **Enhanced Context Management**: Leveraging Claude Agent SDK for intelligent compression
2. **Project Memory**: Automatic context loading from CLAUDE.md files
3. **Conversation Continuity**: Seamless history management across platforms
4. **Performance Optimization**: Efficient token usage and compression strategies

## CLI Usage Examples
```bash
# Use enhanced context features
crewx query "@claude analyze this codebase" --load-project-context

# Enable intelligent compression for long conversations
crewx chat -t my-session --enable-intelligent-compression

# Check AI provider status
crewx doctor

# Initialize new project with templates
crewx init --template development
```

## Future Enhancements
- Integration with additional Claude Agent SDK features
- Enhanced project template system
- Advanced conversation analytics
- Performance monitoring and optimization