# TAW Utils v2.0 - Node MCP Server

## Goals
Convert Python utility scripts to a modern Node.js/TypeScript system with three interfaces:
1. **MCP Server** - For AI agent integration
2. **OpenAPI REST Server** - For HTTP clients
3. **CLI** - Standalone command-line tools

Refer to [MCP_VERSION.md](MCP_VERSION.md) for complete requirements and original Python script documentation.

## Architecture

### Modular Design
- **`src/tools/`** - Shared business logic (framework-agnostic)
- **`src/cli/`** - Command-line interface
- **`src/servers/`** - MCP and API servers
- **`src/utils/`** - Firebase, logging, etc.
- **`src/types/`** - TypeScript interfaces

### Testable Code
- Firebase connections wrapped in `src/utils/firebase.ts`
- All tools return `ToolResult<T>` for consistent testing
- Pure functions in tools layer
- Dependency injection ready

## Current Status

### ✅ Completed (Phase 1 + Models)
1. **Infrastructure** - Config system, utilities, types
2. **Config Tools** - 5 tools for Firebase config collection
3. **Models Tools** - Upload models, update list (stub)
4. **CLI** - 8 working commands
5. **MCP Server** - 7 tools
6. **API Server** - 10 endpoints
7. **Security** - All secrets environment-based
8. **Documentation** - Comprehensive guides

### 🚧 In Progress (Phase 2)
- Plugins tools (GitHub discovery, upload)
- Firebase tools (user creation, project sync)
- Managed server tools (Docker generation)
- Binaries tools (Firebase Storage upload)

## Reference

### Original Code
See `bin/` directory for original Python scripts being migrated.

### New Implementation
- **Tools:** `src/tools/{config,models,plugins,firebase,managed,binaries}/`
- **CLI:** `src/cli/commands/`
- **Servers:** `src/servers/{mcp,api}.ts`

## Testing

### Unit Tests (Coming)
```bash
npm test
npm run test:coverage
```

### Manual Testing
```bash
# CLI
npm run cli -- config validate
npm run cli -- models upload --dry-run

# Servers
npm start              # Both servers
npm run start:mcp      # MCP only
npm run start:api      # API only
```

## Documentation

- **[README.md](README.md)** - Usage guide
- **[PROGRESS.md](PROGRESS.md)** - Implementation progress
- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Detailed status
- **[MCP_VERSION.md](MCP_VERSION.md)** - Original requirements
- **[.env.example](.env.example)** - Configuration reference

## Development

### Adding New Tools
1. Create tool function in `src/tools/[category]/`
2. Add CLI command in `src/cli/commands/[category].ts`
3. Add MCP tool in `src/servers/mcp.ts`
4. Add API endpoint in `src/servers/api.ts`

### Key Principles
- All business logic in `src/tools/` (testable, reusable)
- CLI/MCP/API are thin transport layers
- Each tool is independently executable
- Environment-based configuration
- No hardcoded secrets