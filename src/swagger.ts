/**
 * Swagger/OpenAPI Configuration
 */

export const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "TAW Utils API",
    version: "2.0.0",
    description: "Firebase config management and AI model utilities API",
    contact: {
      name: "TAW Utils",
    },
  },
  servers: [
    {
      url: "http://localhost:3004",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    schemas: {
      ToolResult: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "Whether the operation succeeded",
          },
          data: {
            type: "object",
            description: "Result data (varies by endpoint)",
          },
          error: {
            type: "string",
            description: "Error message if operation failed",
          },
          message: {
            type: "string",
            description: "Human-readable message",
          },
        },
      },
      Model: {
        type: "object",
        required: [
          "model_name",
          "initiator",
          "name",
          "description",
          "family",
          "type",
          "tags",
          "version",
          "url",
          "api_endpoint",
          "access_key",
          "config",
          "score",
          "pricing",
        ],
        properties: {
          model_name: { type: "string" },
          initiator: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          family: { type: "string" },
          type: { type: "string", enum: ["chat", "completion", "embedding"] },
          tags: { type: "array", items: { type: "string" } },
          version: { type: "number" },
          url: { type: "string" },
          api_endpoint: { type: "string" },
          access_key: { type: "string" },
          config: { type: "object" },
          score: { type: "object" },
          pricing: {
            type: "object",
            properties: {
              input_per_1m_tokens: { type: "number" },
              output_per_1m_tokens: { type: "number" },
            },
          },
        },
      },
      MCPServerConfig: {
        type: "object",
        required: ["name", "transport"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          transport: { type: "string", enum: ["stdio", "http", "sse"] },
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          env: { type: "object" },
          url: { type: "string" },
          runtime: { type: "object" },
          capabilities: { type: "object" },
          authentication: { type: "object" },
          setup: { type: "object" },
          tags: { type: "array", items: { type: "string" } },
          verified: { type: "boolean" },
          version: { type: "string" },
        },
      },
    },
  },
  tags: [
    {
      name: "Health",
      description: "Health check endpoints",
    },
    {
      name: "Config",
      description: "Firebase config collection management",
    },
    {
      name: "Models",
      description: "AI model management",
    },
    {
      name: "Plugins",
      description: "MCP server plugin management",
    },
    {
      name: "Firebase",
      description: "Firebase utilities",
    },
    {
      name: "Binaries",
      description: "Binary distribution management",
    },
    {
      name: "Managed",
      description: "Managed server deployment",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Check if the API server is running",
        responses: {
          200: {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/config": {
      get: {
        tags: ["Config"],
        summary: "List config documents",
        description: "Get all documents from the config collection",
        responses: {
          200: {
            description: "List of config documents",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ToolResult" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            documents: {
                              type: "array",
                              items: { type: "object" },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/config/{id}": {
      get: {
        tags: ["Config"],
        summary: "Get config document",
        description: "Get a specific document by ID",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Document ID",
          },
        ],
        responses: {
          200: {
            description: "Config document",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Config"],
        summary: "Create config document",
        description: "Create a new document (fails if exists)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: {
          200: {
            description: "Document created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Config"],
        summary: "Update config document",
        description: "Update or create a document (merge)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: {
          200: {
            description: "Document updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/models/update": {
      post: {
        tags: ["Models"],
        summary: "Update model list",
        description: "Fetch latest models from provider APIs",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  provider: {
                    type: "string",
                    enum: ["openai", "anthropic", "google", "mistral", "ollama", "all"],
                    default: "all",
                  },
                  modelsFile: { type: "string", default: "config/models.json" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Models updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/models/upload": {
      post: {
        tags: ["Models"],
        summary: "Upload models to Firestore",
        description: "Upload models from file to Firestore config collection",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  modelsFile: { type: "string", default: "config/models.json" },
                  collection: { type: "string", default: "config" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Models uploaded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/plugins/discover": {
      post: {
        tags: ["Plugins"],
        summary: "Discover MCP servers",
        description: "Discover MCP servers from GitHub repository",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["githubUrl"],
                properties: {
                  githubUrl: {
                    type: "string",
                    description: "GitHub repository URL",
                    example: "https://github.com/modelcontextprotocol/servers",
                  },
                  outputFile: {
                    type: "string",
                    default: "config/library-discovered.json",
                  },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Servers discovered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/plugins/upload": {
      post: {
        tags: ["Plugins"],
        summary: "Upload plugins to Firestore",
        description: "Upload plugin library to Firestore",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["libraryFile", "organizationId", "docId"],
                properties: {
                  libraryFile: { type: "string" },
                  organizationId: { type: "string", description: "Organization ID (* for global)" },
                  docId: { type: "string", description: "Must start with plugin-mcp-" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Plugins uploaded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/firebase/create-user": {
      post: {
        tags: ["Firebase"],
        summary: "Create Firebase user",
        description: "Create a Firebase user with profile and actor documents",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "User created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/firebase/copy-projects": {
      post: {
        tags: ["Firebase"],
        summary: "Copy Firestore projects",
        description: "Copy documents between Firebase projects",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sourceServiceAccount", "destServiceAccount"],
                properties: {
                  sourceServiceAccount: { type: "string" },
                  destServiceAccount: { type: "string" },
                  collections: { type: "array", items: { type: "string" } },
                  userIdMap: { type: "object" },
                  dryRun: { type: "boolean", default: false },
                  verbose: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Projects copied",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/binaries/upload": {
      post: {
        tags: ["Binaries"],
        summary: "Upload binaries",
        description: "Upload binary files to Firebase Storage",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  platform: {
                    type: "string",
                    enum: ["mac", "linux", "windows", "all"],
                    default: "all",
                  },
                  version: { type: "string", default: "latest" },
                  directory: { type: "string", default: "./dist" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Binaries uploaded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/managed/generate": {
      post: {
        tags: ["Managed"],
        summary: "Generate managed server",
        description: "Generate managed server directory with Docker configuration",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["directory", "workstationId", "organizationId"],
                properties: {
                  directory: { type: "string" },
                  workstationId: { type: "string" },
                  organizationId: { type: "string" },
                  apiPort: { type: "number", default: 3021 },
                  name: { type: "string", default: "Managed Workspace" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Server generated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
    "/api/managed/build": {
      post: {
        tags: ["Managed"],
        summary: "Build Docker image",
        description: "Build Docker image for managed server",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["directory"],
                properties: {
                  directory: { type: "string" },
                  dryRun: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Image built",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ToolResult" },
              },
            },
          },
        },
      },
    },
  },
};

export const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [],
};
