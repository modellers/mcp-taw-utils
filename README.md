# mcp-taw-utils

TAW Utils - MCP Server for Firebase Config Management

## Description

A Node.js MCP (Model Context Protocol) server that provides Firebase Admin SDK integration for managing configuration data in a Firestore "config" collection.

## Features

The server provides the following tools:

1. **mcp_collection_list** - List all documents in the Firebase 'config' collection
2. **mcp_collection_get** - Get a local copy of a document by ID
3. **mcp_collection_set** - Add or create a document in the collection
4. **mcp_collection_item_from_git** - Extract Git MCP config from a repository URI
5. **mcp_collection_item_set** - Update Git MCP config by ID

## Setup

### Prerequisites

- Node.js 20 or higher
- Firebase Admin service account credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/modellers/mcp-taw-utils.git
cd mcp-taw-utils
```

2. Install dependencies:
```bash
npm install
```

3. Create a secrets directory and add your Firebase service account key:
```bash
mkdir secrets
# Place your Firebase service account JSON file at:
# ./secrets/tasking-agency-serviceaccount.json
```

4. Build the project:
```bash
npm run build
```

## Usage

### Running the Server

The server runs as an MCP server using stdio transport:

```bash
node dist/index.js
```

### Configuration with MCP Clients

To use this server with an MCP client (like Claude Desktop), add it to your MCP configuration:

```json
{
  "mcpServers": {
    "mcp-taw-utils": {
      "command": "node",
      "args": ["/path/to/mcp-taw-utils/dist/index.js"]
    }
  }
}
```

## Available Tools

### mcp_collection_list

List all documents in the Firebase 'config' collection.

**Parameters:** None

**Returns:** JSON array of documents with their IDs and data.

### mcp_collection_get

Get a local copy of a document from the 'config' collection.

**Parameters:**
- `id` (string, required): The document ID to retrieve

**Returns:** Document data as JSON.

### mcp_collection_set

Add or create a document in the 'config' collection.

**Parameters:**
- `id` (string, required): The document ID
- `data` (object, required): The data to store

**Returns:** Success message.

### mcp_collection_item_from_git

Extract Git MCP config from a URI. Parses various Git URI formats.

**Parameters:**
- `uri` (string, required): Git repository URI (supports HTTPS, SSH, and bare formats)

**Returns:** Parsed Git configuration including host, path, owner, repo, etc.

**Example URIs:**
- `https://github.com/user/repo.git`
- `git@github.com:user/repo.git`
- `github.com/user/repo`

### mcp_collection_item_set

Update Git MCP config by ID in the 'config' collection.

**Parameters:**
- `id` (string, required): The document ID to update
- `gitConfig` (object, required): The Git MCP configuration

**Returns:** Success message.

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

## License

MIT
