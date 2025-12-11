# MCP TAW Utils - Technical Documentation

## Architecture

This MCP server is built using the Model Context Protocol SDK and provides Firebase Firestore integration for managing configuration data.

### Components

#### 1. Firebase Module (`src/firebase.ts`)
- Initializes Firebase Admin SDK
- Loads service account credentials from `./secrets/tasking-agency-serviceaccount.json`
- Provides access to Firestore database instance
- Throws error if Firebase is not properly initialized

#### 2. Tools Module (`src/tools.ts`)
Implements all five endpoint functionalities:

**mcp_collection_list**
- Retrieves all documents from the "config" collection in Firestore
- Returns an array of documents with their IDs and data
- Uses Firebase snapshot to get all documents at once

**mcp_collection_get**
- Fetches a single document by ID from the "config" collection
- Returns the document data or a "not found" message
- Provides a local copy of the document data

**mcp_collection_set**
- Creates or updates a document in the "config" collection
- Uses `set()` with `merge: true` to update existing documents or create new ones
- Accepts any JSON-serializable data structure

**mcp_collection_item_from_git**
- Parses Git repository URIs and extracts configuration
- Supports multiple formats:
  - HTTPS: `https://github.com/user/repo.git`
  - SSH: `git@github.com:user/repo.git`
  - Bare: `github.com/user/repo`
- Extracts: host, path, protocol, owner, and repo name
- Returns structured Git configuration object

**mcp_collection_item_set**
- Updates or creates a document with Git MCP configuration
- Adds timestamps (createdAt, updatedAt)
- Stores Git configuration in the gitConfig field
- Updates existing documents or creates new ones

#### 3. Main Server (`src/index.ts`)
- Sets up MCP server with stdio transport
- Registers all five tools with their schemas
- Handles tool invocation requests
- Provides error handling for all operations
- Initializes Firebase on startup

## Data Flow

1. **Server Start**: 
   - Initialize Firebase Admin SDK
   - Load service account credentials
   - Connect Firestore database
   - Register MCP tools

2. **Tool Invocation**:
   - Client sends tool request via stdio
   - Server validates parameters
   - Tool function executes Firebase operation
   - Result returned as JSON response

3. **Error Handling**:
   - Invalid parameters → Error response
   - Firebase errors → Error response with details
   - Missing documents → Informative message

## Firebase Collection Structure

### Collection: "config"

Documents can have flexible schemas, but Git config documents follow this structure:

```json
{
  "gitConfig": {
    "uri": "https://github.com/user/repo.git",
    "type": "git",
    "host": "github.com",
    "path": "user/repo",
    "protocol": "https",
    "owner": "user",
    "repo": "repo",
    "parsedAt": "2025-12-11T05:00:00.000Z"
  },
  "createdAt": "2025-12-11T05:00:00.000Z",
  "updatedAt": "2025-12-11T05:00:00.000Z"
}
```

## Security Considerations

1. **Service Account**: 
   - Credentials stored in `./secrets/` directory
   - Directory is git-ignored
   - Example file provided for reference

2. **Firebase Rules**:
   - Server uses Admin SDK with elevated privileges
   - Ensure Firestore security rules are properly configured
   - Recommend read/write restrictions at database level

3. **Input Validation**:
   - All tool parameters are validated before execution
   - Type checking for required fields
   - Error messages don't expose internal details

## Development

### Building
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Project Structure
```
mcp-taw-utils/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── firebase.ts       # Firebase initialization
│   └── tools.ts          # Tool implementations
├── dist/                 # Compiled JavaScript (git-ignored)
├── secrets/              # Service account credentials (git-ignored)
│   └── *.json.example    # Example credential file
├── package.json
├── tsconfig.json
└── README.md
```

### TypeScript Configuration
- Target: ES2022
- Module: Node16
- Strict mode enabled
- Source maps generated
- Declaration files generated

## Usage Examples

### Using with Claude Desktop

Add to your MCP configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-taw-utils": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-taw-utils/dist/index.js"]
    }
  }
}
```

### Tool Usage Examples

**List all configs:**
```
Use the mcp_collection_list tool
```

**Get a specific config:**
```
Use mcp_collection_get with id="my-config"
```

**Create/update a config:**
```
Use mcp_collection_set with:
- id="my-config"
- data={"name": "My Config", "value": 123}
```

**Extract Git config from URI:**
```
Use mcp_collection_item_from_git with:
- uri="https://github.com/user/repo.git"
```

**Update Git config:**
```
Use mcp_collection_item_set with:
- id="my-git-config"
- gitConfig={"uri": "...", "host": "github.com", ...}
```

## Troubleshooting

### Common Issues

1. **"Firebase not initialized"**
   - Ensure service account file exists at `./secrets/tasking-agency-serviceaccount.json`
   - Check file permissions
   - Verify JSON syntax in service account file

2. **"Document not found"**
   - Document ID doesn't exist in collection
   - Check spelling and case sensitivity

3. **Permission errors**
   - Verify service account has Firestore access
   - Check Firebase project configuration

4. **Connection errors**
   - Verify internet connectivity
   - Check firewall settings
   - Ensure Firebase project is active

## Future Enhancements

Potential improvements:
- Batch operations for multiple documents
- Query filtering and pagination
- Validation schemas for Git configs
- Caching layer for frequently accessed configs
- Health check endpoint
- Logging and monitoring integration
