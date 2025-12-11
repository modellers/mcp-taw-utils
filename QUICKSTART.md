# Quick Start Guide

## Setup (First Time)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add Firebase credentials:**
   - Copy `secrets/tasking-agency-serviceaccount.json.example` to `secrets/tasking-agency-serviceaccount.json`
   - Fill in your actual Firebase service account credentials

3. **Build the project:**
   ```bash
   npm run build
   ```

## Running the Server

```bash
node dist/index.js
```

The server runs as an MCP server using stdio transport.

## Using with MCP Clients

### Claude Desktop

Add to your MCP configuration:

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

## Available Tools

### 1. mcp_collection_list
List all documents in the config collection.
```
No parameters required
```

### 2. mcp_collection_get
Get a specific document by ID.
```
Parameters:
- id: string (required)
```

### 3. mcp_collection_set
Create or update a document.
```
Parameters:
- id: string (required)
- data: object (required)
```

### 4. mcp_collection_item_from_git
Extract Git MCP config from URI.
```
Parameters:
- uri: string (required)

Supported formats:
- https://github.com/user/repo.git
- git@github.com:user/repo.git
- github.com/user/repo
```

### 5. mcp_collection_item_set
Update Git MCP config by ID.
```
Parameters:
- id: string (required)
- gitConfig: object (required)
```

## Development

### Watch Mode
```bash
npm run watch
```

### Rebuild
```bash
npm run build
```

## Troubleshooting

### "Firebase not initialized"
- Check that `secrets/tasking-agency-serviceaccount.json` exists
- Verify the JSON format is correct
- Ensure file permissions allow reading

### "Document not found"
- Verify the document ID exists in Firestore
- Check for typos in the ID

### Connection errors
- Verify internet connectivity
- Check Firebase project is active
- Ensure service account has proper permissions

## More Information

See [README.md](README.md) for detailed documentation.
See [TECHNICAL.md](TECHNICAL.md) for architecture details.
