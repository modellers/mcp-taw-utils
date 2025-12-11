#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initializeFirebase, getFirestore } from "./firebase.js";
import {
  listCollection,
  getCollection,
  setCollection,
  getItemFromGit,
  setCollectionItem,
} from "./tools.js";

const server = new Server(
  {
    name: "mcp-taw-utils",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Firebase
initializeFirebase();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "mcp_collection_list",
        description: "List all documents in the Firebase 'config' collection",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "mcp_collection_get",
        description: "Get a local copy of a document from the 'config' collection by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The document ID to retrieve",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "mcp_collection_set",
        description: "Add or create a document in the 'config' collection",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The document ID",
            },
            data: {
              type: "object",
              description: "The data to store in the document",
            },
          },
          required: ["id", "data"],
        },
      },
      {
        name: "mcp_collection_item_from_git",
        description: "Extract Git MCP config from a URI",
        inputSchema: {
          type: "object",
          properties: {
            uri: {
              type: "string",
              description: "The Git repository URI to extract config from",
            },
          },
          required: ["uri"],
        },
      },
      {
        name: "mcp_collection_item_set",
        description: "Update Git MCP config by ID in the 'config' collection",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The document ID to update",
            },
            gitConfig: {
              type: "object",
              description: "The Git MCP configuration to update",
            },
          },
          required: ["id", "gitConfig"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "mcp_collection_list":
        return await listCollection();

      case "mcp_collection_get":
        if (!args || typeof args.id !== "string") {
          throw new Error("Invalid arguments: 'id' is required");
        }
        return await getCollection(args.id);

      case "mcp_collection_set":
        if (!args || typeof args.id !== "string" || !args.data) {
          throw new Error("Invalid arguments: 'id' and 'data' are required");
        }
        return await setCollection(args.id, args.data);

      case "mcp_collection_item_from_git":
        if (!args || typeof args.uri !== "string") {
          throw new Error("Invalid arguments: 'uri' is required");
        }
        return await getItemFromGit(args.uri);

      case "mcp_collection_item_set":
        if (!args || typeof args.id !== "string" || !args.gitConfig) {
          throw new Error("Invalid arguments: 'id' and 'gitConfig' are required");
        }
        return await setCollectionItem(args.id, args.gitConfig);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP TAW Utils server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
