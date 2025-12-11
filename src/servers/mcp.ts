#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initializeFirebase } from "../utils/firebase.js";
import {
  listCollection,
  getCollection,
  setCollection,
  getItemFromGit,
  setCollectionItem,
} from "../tools/config/index.js";
import { updateModelList, uploadModels } from "../tools/models/index.js";
import { discoverMCPServers, uploadPlugins } from "../tools/plugins/index.js";
import { createUser, copyProjects } from "../tools/firebase/index.js";
import { uploadBinaries } from "../tools/binaries/index.js";
import { generateManagedServer, buildDockerImage } from "../tools/managed/index.js";
import { createLogger } from "../utils/logger.js";
import type { Config } from "../config.js";

const logger = createLogger("mcp-server");

/**
 * Start the MCP server
 */
export async function startMCPServer(config: Config): Promise<void> {
  logger.info("Starting MCP server...");

  const server = new Server(
    {
      name: "mcp-taw-utils",
      version: "2.0.0",
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
    logger.debug("Listing available tools");
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
          description: "Get a document from the 'config' collection by ID",
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
          description: "Create or update a document in the 'config' collection",
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
              merge: {
                type: "boolean",
                description: "Whether to merge with existing data (default: true)",
                default: true,
              },
            },
            required: ["id", "data"],
          },
        },
        {
          name: "mcp_collection_item_from_git",
          description: "Extract Git MCP config from a repository URI",
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
        {
          name: "update_model_list",
          description: "Update AI model list from provider APIs (stub implementation)",
          inputSchema: {
            type: "object",
            properties: {
              provider: {
                type: "string",
                description: "Provider to update (openai, anthropic, google, mistral, ollama, all)",
                enum: ["openai", "anthropic", "google", "mistral", "ollama", "all"],
                default: "all",
              },
              modelsFile: {
                type: "string",
                description: "Path to models.json file",
                default: "config/models.json",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without writing",
                default: false,
              },
            },
          },
        },
        {
          name: "upload_models_to_firestore",
          description: "Upload AI model configurations to Firestore config collection",
          inputSchema: {
            type: "object",
            properties: {
              modelsFile: {
                type: "string",
                description: "Path to models.json file",
                default: "config/models.json",
              },
              collection: {
                type: "string",
                description: "Firestore collection name",
                default: "config",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without uploading",
                default: false,
              },
            },
          },
        },
        {
          name: "discover_mcp_servers",
          description: "Discover MCP servers from GitHub repositories (stub implementation)",
          inputSchema: {
            type: "object",
            properties: {
              githubUrl: {
                type: "string",
                description: "GitHub repository URL",
              },
              outputFile: {
                type: "string",
                description: "Output file path",
                default: "config/library-discovered.json",
              },
              agent: {
                type: "string",
                description: "AI agent to use for analysis",
                default: "agent_research",
              },
              skipAI: {
                type: "boolean",
                description: "Skip AI analysis (faster, less accurate)",
                default: false,
              },
              dryRun: {
                type: "boolean",
                description: "Preview without writing",
                default: false,
              },
            },
          },
        },
        {
          name: "upload_plugins_to_firestore",
          description: "Upload MCP plugin library to Firestore config collection",
          inputSchema: {
            type: "object",
            properties: {
              libraryFile: {
                type: "string",
                description: "Path to library JSON file",
              },
              organizationId: {
                type: "string",
                description: "Organization ID (* for global)",
              },
              docId: {
                type: "string",
                description: "Document ID (must start with plugin-mcp-)",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without uploading",
                default: false,
              },
            },
            required: ["libraryFile", "organizationId", "docId"],
          },
        },
        {
          name: "create_firebase_user",
          description: "Create Firebase user with profile and actor documents",
          inputSchema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                description: "User email address",
              },
              password: {
                type: "string",
                description: "User password (min 6 characters)",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without creating",
                default: false,
              },
            },
            required: ["email", "password"],
          },
        },
        {
          name: "copy_firebase_projects",
          description: "Copy Firestore documents between projects with user ID replacement",
          inputSchema: {
            type: "object",
            properties: {
              sourceServiceAccountPath: {
                type: "string",
                description: "Source service account JSON path",
              },
              destServiceAccountPath: {
                type: "string",
                description: "Destination service account JSON path",
              },
              collections: {
                type: "array",
                items: { type: "string" },
                description: "Collections to copy (default: tasking,task,project,thread,profile)",
              },
              userIdMapFile: {
                type: "string",
                description: "User ID mapping JSON file path",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without copying",
                default: false,
              },
              verbose: {
                type: "boolean",
                description: "Detailed logging",
                default: false,
              },
            },
            required: ["sourceServiceAccountPath", "destServiceAccountPath"],
          },
        },
        {
          name: "upload_binaries_to_storage",
          description: "Upload built binaries to Firebase Storage for distribution",
          inputSchema: {
            type: "object",
            properties: {
              platform: {
                type: "string",
                enum: ["mac", "windows", "linux", "all"],
                description: "Platform to upload (default: all)",
                default: "all",
              },
              version: {
                type: "string",
                description: "Version tag (default: latest)",
                default: "latest",
              },
              directory: {
                type: "string",
                description: "Build directory (default: ./dist)",
                default: "./dist",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without uploading",
                default: false,
              },
            },
          },
        },
        {
          name: "generate_managed_server",
          description: "Generate isolated Docker-based managed server configuration",
          inputSchema: {
            type: "object",
            properties: {
              directory: {
                type: "string",
                description: "Directory where server files will be created",
              },
              workstationId: {
                type: "string",
                description: "Managed workspace ID",
              },
              organizationId: {
                type: "string",
                description: "Organization ID for multi-tenant isolation",
              },
              apiPort: {
                type: "number",
                description: "External API port (default: 3021)",
                default: 3021,
              },
              name: {
                type: "string",
                description: "Workspace display name",
                default: "Managed Workspace",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without creating",
                default: false,
              },
            },
            required: ["directory", "workstationId", "organizationId"],
          },
        },
        {
          name: "build_docker_image",
          description: "Build Docker image for managed server",
          inputSchema: {
            type: "object",
            properties: {
              directory: {
                type: "string",
                description: "Managed server directory path",
              },
              dryRun: {
                type: "boolean",
                description: "Preview without building",
                default: false,
              },
            },
            required: ["directory"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.debug(`Handling tool call: ${name}`);

    try {
      let result;

      switch (name) {
        case "mcp_collection_list":
          result = await listCollection();
          break;

        case "mcp_collection_get":
          if (!args || typeof args.id !== "string") {
            throw new Error("Invalid arguments: 'id' is required");
          }
          result = await getCollection(args.id);
          break;

        case "mcp_collection_set":
          if (!args || typeof args.id !== "string" || !args.data) {
            throw new Error("Invalid arguments: 'id' and 'data' are required");
          }
          result = await setCollection(
            args.id,
            args.data as Record<string, unknown>,
            args.merge !== false
          );
          break;

        case "mcp_collection_item_from_git":
          if (!args || typeof args.uri !== "string") {
            throw new Error("Invalid arguments: 'uri' is required");
          }
          result = await getItemFromGit(args.uri);
          break;

        case "mcp_collection_item_set":
          if (!args || typeof args.id !== "string" || !args.gitConfig) {
            throw new Error(
              "Invalid arguments: 'id' and 'gitConfig' are required"
            );
          }
          result = await setCollectionItem(args.id, args.gitConfig as any);
          break;

        case "update_model_list":
          result = await updateModelList({
            provider: args?.provider as any,
            modelsFile: args?.modelsFile as string,
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "upload_models_to_firestore":
          result = await uploadModels({
            modelsFile: args?.modelsFile as string,
            collection: args?.collection as string,
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "discover_mcp_servers":
          result = await discoverMCPServers({
            githubUrl: args?.githubUrl as string,
            outputFile: args?.outputFile as string,
            agent: args?.agent as string,
            skipAI: args?.skipAI as boolean,
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "upload_plugins_to_firestore":
          if (!args?.libraryFile || !args?.organizationId || !args?.docId) {
            throw new Error(
              "Invalid arguments: 'libraryFile', 'organizationId', and 'docId' are required"
            );
          }
          result = await uploadPlugins({
            libraryFile: args.libraryFile as string,
            organizationId: args.organizationId as string,
            docId: args.docId as string,
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "create_firebase_user":
          if (!args?.email || !args?.password) {
            throw new Error(
              "Invalid arguments: 'email' and 'password' are required"
            );
          }
          result = await createUser({
            email: args.email as string,
            password: args.password as string,
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "copy_firebase_projects":
          if (!args?.sourceServiceAccountPath || !args?.destServiceAccountPath) {
            throw new Error(
              "Invalid arguments: 'sourceServiceAccountPath' and 'destServiceAccountPath' are required"
            );
          }
          result = await copyProjects({
            sourceServiceAccountPath: args.sourceServiceAccountPath as string,
            destServiceAccountPath: args.destServiceAccountPath as string,
            collections: args?.collections as string[],
            userIdMapFile: args?.userIdMapFile as string,
            dryRun: args?.dryRun as boolean,
            verbose: args?.verbose as boolean,
          });
          break;

        case "upload_binaries_to_storage":
          result = await uploadBinaries({
            platform: (args?.platform as "mac" | "windows" | "linux" | "all") || "all",
            version: (args?.version as string) || "latest",
            directory: (args?.directory as string) || "./dist",
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "generate_managed_server":
          if (!args?.directory || !args?.workstationId || !args?.organizationId) {
            throw new Error(
              "Invalid arguments: 'directory', 'workstationId', and 'organizationId' are required"
            );
          }
          result = await generateManagedServer({
            directory: args.directory as string,
            workstationId: args.workstationId as string,
            organizationId: args.organizationId as string,
            apiPort: (args?.apiPort as number) || 3021,
            name: (args?.name as string) || "Managed Workspace",
            dryRun: args?.dryRun as boolean,
          });
          break;

        case "build_docker_image":
          if (!args?.directory) {
            throw new Error("Invalid arguments: 'directory' is required");
          }
          result = await buildDockerImage({
            directory: args.directory as string,
            dryRun: args?.dryRun as boolean,
          });
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Format response
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  data: result.data,
                  message: result.message,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Tool call failed: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: errorMessage,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server running on stdio");
}
