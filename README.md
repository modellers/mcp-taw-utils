# TAW Utils v2.0

**Comprehensive Firebase config management and AI model utilities**

A multi-interface toolset providing MCP (Model Context Protocol) server, REST API, and CLI for managing Firebase configurations, AI models, MCP plugins, and deployment infrastructure.

## Features

- 🔧 **Shared Tools Library** - Framework-agnostic business logic
- 🤖 **MCP Server** - Stdio/SSE transport for AI agent integration
- 🌐 **OpenAPI REST Server** - HTTP REST API with Swagger docs
- ⚡ **Standalone CLI** - No server dependency required
- 🔐 **Security First** - Environment-based configuration, no hardcoded secrets
- 🎯 **Flexible Deployment** - Run servers independently or together
- 📦 **TypeScript** - Full type safety throughout

## Quick Start

### Prerequisites

- Node.js 20 or higher
- Firebase Admin service account credentials
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/modellers/mcp-taw-utils.git
cd mcp-taw-utils

# Install dependencies
npm install

# Create secrets directory and add your Firebase service account
mkdir secrets
# Place your service account JSON at: ./secrets/tasking-agency-serviceaccount.json

# Create .env file from example
cp .env.example .env
# Edit .env with your configuration

# Build the project
npm run build
```

### Verify Installation

```bash
# Validate configuration
npm run cli -- config validate

# Check health
npm run cli -- health
```

## Usage

### 1. CLI (Standalone - No Server Required)

```bash
# Using npm scripts
npm run cli -- config list

# Or use the installed binary
node dist/cli/index.js config list

# After installing globally
npm install -g .
taw-utils config list
```

**Available Commands:**

```bash
# Config management
taw-utils config list                    # List all config documents
taw-utils config get <id>                # Get a document by ID
taw-utils config set <id> --file data.json  # Create/update document
taw-utils config validate                # Validate configuration

# Health check
taw-utils health                         # Check Firebase connection

# Model management (coming soon)
taw-utils models list
taw-utils models update --provider openai
taw-utils models upload --dry-run

# Plugin management (coming soon)
taw-utils plugins discover <github-url>
taw-utils plugins upload --library library.json

# Firebase utilities (coming soon)
taw-utils firebase user-create <email> <password>
taw-utils firebase copy --collections tasking,task

# Managed servers (coming soon)
taw-utils managed generate --dir ./servers/prod
taw-utils managed build --dir ./servers/prod

# Binary distribution (coming soon)
taw-utils binaries upload --platform mac
```

### 2. MCP Server (For AI Agents)

```bash
# Start MCP server only (stdio)
npm run start:mcp

# Or with both servers
npm start
```

**Available MCP Tools:**

- `mcp_collection_list` - List all config documents
- `mcp_collection_get` - Get document by ID
- `mcp_collection_set` - Create/update document
- `mcp_collection_item_from_git` - Parse Git URI
- `mcp_collection_item_set` - Update Git config

**MCP Client Configuration:**

```json
{
  "mcpServers": {
    "mcp-taw-utils": {
      "command": "node",
      "args": ["/path/to/mcp-taw-utils/dist/servers/mcp.js"]
    }
  }
}
```

### 3. OpenAPI REST Server

```bash
# Start API server only
npm run start:api

# Or with both servers
npm start
```

The API server runs on port 3004 by default (configurable via `API_SERVER_PORT`).

**Endpoints:**

```
GET    /health                # Health check
GET    /                      # API documentation

# Config collection
GET    /api/config            # List all documents
GET    /api/config/:id        # Get document
POST   /api/config/:id        # Create document
PUT    /api/config/:id        # Update document

# Git utilities
POST   /api/git/parse         # Parse Git URI
POST   /api/git/config/:id    # Update Git config
```

**Examples:**

```bash
# Health check
curl http://localhost:3004/health

# List config documents
curl http://localhost:3004/api/config

# Get specific document
curl http://localhost:3004/api/config/models-openai

# Create/update document
curl -X POST http://localhost:3004/api/config/my-doc \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":"value"}'

# Parse Git URI
curl -X POST http://localhost:3004/api/git/parse \
  -H "Content-Type: application/json" \
  -d '{"uri":"https://github.com/user/repo.git"}'
```

**With Authentication:**

```bash
# Set in .env
API_AUTH_ENABLED=true
API_KEY=your-secret-key

# Use in requests
curl http://localhost:3004/api/config \
  -H "X-API-Key: your-secret-key"
```

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example` for all options):

```bash
# Required
FIREBASE_PROJECT_ID=tasking-agency-is
FIREBASE_STORAGE_BUCKET=tasking-agency-is.appspot.com
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/tasking-agency-serviceaccount.json

# Server Configuration
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3023          # 0 = disabled (stdio only)
MCP_TRANSPORT=stdio           # stdio | sse | both

API_SERVER_ENABLED=true
API_SERVER_PORT=3004          # 0 = disabled
API_AUTH_ENABLED=false
API_KEY=your-secret-key

# Optional - AI Service API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
MISTRAL_API_KEY=...
GITHUB_TOKEN=ghp_...
```

### Server Modes

**Both Servers (Default):**
```bash
npm start
# MCP on stdio, API on port 3004
```

**MCP Only:**
```bash
npm run start:mcp
# or
MCP_SERVER_ENABLED=true API_SERVER_ENABLED=false npm start
```

**API Only:**
```bash
npm run start:api
# or
API_SERVER_ENABLED=true MCP_SERVER_ENABLED=false npm start
```

**Disable MCP Port (Stdio Only):**
```bash
MCP_SERVER_PORT=0 npm start
```

**Disable API Server:**
```bash
API_SERVER_PORT=0 npm start
```

## Architecture

```
src/
├── tools/              # Shared business logic (framework-agnostic)
│   ├── config/        # Config collection tools
│   ├── models/        # Model management (coming soon)
│   ├── plugins/       # Plugin discovery (coming soon)
│   ├── firebase/      # Firebase utilities (coming soon)
│   ├── managed/       # Managed servers (coming soon)
│   └── binaries/      # Binary upload (coming soon)
├── cli/
│   ├── index.ts       # CLI entry point
│   └── commands/      # Command handlers
├── servers/
│   ├── mcp.ts         # MCP server
│   ├── api.ts         # OpenAPI server
│   └── index.ts       # Server launcher
├── types/             # TypeScript interfaces
├── utils/             # Utilities (firebase, logger)
└── config.ts          # Configuration system
```

**Key Principles:**

1. **All business logic lives in `src/tools/`** - Pure functions, no framework dependencies
2. **CLI/MCP/API are thin wrappers** - Just transport layers
3. **Each tool is independently executable** - Can be imported and used directly
4. **Environment-based configuration** - No hardcoded secrets

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Run Tests

```bash
npm test                # Run all tests
npm run test:unit       # Run unit tests only
npm run test:coverage   # Run with coverage
```

### Add New Tools

1. **Create tool function in `src/tools/[category]/`:**

```typescript
// src/tools/models/updateModelList.ts
export async function updateModelList(options: UpdateModelsOptions): Promise<ToolResult> {
  // Business logic here
  return { success: true, data: models };
}
```

2. **Add CLI command in `src/cli/commands/[category].ts`:**

```typescript
export const modelsCommand = {
  async list() {
    const result = await updateModelList({ provider: 'all' });
    console.log(JSON.stringify(result.data, null, 2));
  }
};
```

3. **Add MCP tool in `src/servers/mcp.ts`:**

```typescript
case "update_model_list":
  result = await updateModelList(args);
  break;
```

4. **Add API endpoint in `src/servers/api.ts`:**

```typescript
app.post("/api/models/update", async (req, res) => {
  const result = await updateModelList(req.body);
  res.json(result);
});
```

## Security

### Best Practices

- ✅ **Never commit secrets** - Use `.env` files (git-ignored)
- ✅ **Service account discovery** - Automatic fallback to multiple paths
- ✅ **Environment validation** - Fails fast if required secrets missing
- ✅ **API authentication** - Optional API key/JWT support
- ✅ **Audit logging** - Structured logging with levels

### Security Checklist

1. Create `.env` file from `.env.example`
2. Add service account JSON to `secrets/` directory
3. Verify `.gitignore` includes `.env` and `secrets/`
4. Enable API authentication in production (`API_AUTH_ENABLED=true`)
5. Use strong API keys (`API_KEY=...`)
6. Review Firebase service account permissions
7. Rotate keys regularly (recommended: 90 days)

## Migration from Python Scripts

The `bin/` directory contains original Python scripts. These are being migrated to Node.js:

| Python Script | Status | Node Equivalent |
|--------------|--------|-----------------|
| `bin/models/upload_models.py` | ✅ Planned | `src/tools/models/` |
| `bin/plugin/discover-mcp.ts` | ✅ Planned | `src/tools/plugins/` |
| `bin/firebase/copy-projects.py` | ✅ Planned | `src/tools/firebase/` |
| `bin/managed/generate-server.py` | ✅ Planned | `src/tools/managed/` |
| `bin/upload-binaries.py` | ✅ Planned | `src/tools/binaries/` |

**Current Phase:**
✅ Project structure, configuration, and servers
🚧 Core tools implementation (next phase)

## Documentation

- [MCP_VERSION.md](MCP_VERSION.md) - Original requirements and Python script documentation
- [CLAUDE.md](CLAUDE.md) - Project overview
- `.env.example` - Complete environment variable reference

## Troubleshooting

### Configuration Issues

```bash
# Validate your configuration
npm run cli -- config validate

# Check Firebase connection
npm run cli -- health
```

### Common Errors

**Error: "Firebase service account not found"**
```bash
# Solution: Create secrets directory and add service account
mkdir secrets
cp /path/to/serviceaccount.json ./secrets/tasking-agency-serviceaccount.json
```

**Error: "No servers enabled"**
```bash
# Solution: Enable at least one server
# In .env:
MCP_SERVER_ENABLED=true
# OR
API_SERVER_ENABLED=true
```

**Error: "FIREBASE_PROJECT_ID is required"**
```bash
# Solution: Add to .env
FIREBASE_PROJECT_ID=your-project-id
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/modellers/mcp-taw-utils/issues
- Documentation: See [MCP_VERSION.md](MCP_VERSION.md)

---

**Version:** 2.0.0
**Last Updated:** December 11, 2025
