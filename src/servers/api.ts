import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
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
import { swaggerOptions } from "../swagger.js";
import type { Config } from "../config.js";
import type { GitConfig } from "../types/index.js";

const logger = createLogger("api-server");

/**
 * Authentication middleware
 */
function authMiddleware(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.API_AUTH_ENABLED) {
      return next();
    }

    const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");

    if (!apiKey || apiKey !== config.API_KEY) {
      logger.warn(`Unauthorized API access attempt from ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized - Invalid or missing API key",
      });
    }

    next();
  };
}

/**
 * Error handler middleware
 */
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(`API error: ${err.message}`, err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
}

/**
 * Start the OpenAPI REST server
 */
export async function startAPIServer(config: Config): Promise<void> {
  logger.info("Starting API server...");

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware(config));

  // Initialize Firebase
  initializeFirebase();

  // Swagger/OpenAPI Documentation
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
    });
  });

  // API Documentation
  app.get("/", (req, res) => {
    res.json({
      name: "TAW Utils API",
      version: "2.0.0",
      description: "Firebase config management and AI model utilities API",
      endpoints: {
        health: "GET /health",
        config: {
          list: "GET /api/config",
          get: "GET /api/config/:id",
          create: "POST /api/config/:id",
          update: "PUT /api/config/:id",
        },
        git: {
          parse: "POST /api/git/parse",
          updateConfig: "POST /api/git/config/:id",
        },
        models: {
          update: "POST /api/models/update",
          upload: "POST /api/models/upload",
        },
        plugins: {
          discover: "POST /api/plugins/discover",
          upload: "POST /api/plugins/upload",
        },
        firebase: {
          createUser: "POST /api/firebase/create-user",
          copyProjects: "POST /api/firebase/copy-projects",
        },
        binaries: {
          upload: "POST /api/binaries/upload",
        },
        managed: {
          generate: "POST /api/managed/generate",
          build: "POST /api/managed/build",
        },
      },
      documentation: "/api-docs",
    });
  });

  // ============================================
  // Config Collection Routes
  // ============================================

  /**
   * GET /api/config
   * List all config documents
   */
  app.get("/api/config", async (req, res, next) => {
    try {
      logger.debug("API: Listing config documents");
      const result = await listCollection();

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          count: result.data?.length || 0,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/config/:id
   * Get a specific config document
   */
  app.get("/api/config/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      logger.debug(`API: Getting config document: ${id}`);

      const result = await getCollection(id);

      if (result.success) {
        if (result.data) {
          res.json({
            success: true,
            data: result.data,
          });
        } else {
          res.status(404).json({
            success: false,
            error: `Document '${id}' not found`,
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/config/:id
   * Create a new config document
   */
  app.post("/api/config/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = req.body;

      logger.debug(`API: Creating config document: ${id}`);

      const result = await setCollection(id, data, false);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/config/:id
   * Update (merge) an existing config document
   */
  app.put("/api/config/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = req.body;

      logger.debug(`API: Updating config document: ${id}`);

      const result = await setCollection(id, data, true);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Git Config Routes
  // ============================================

  /**
   * POST /api/git/parse
   * Parse a Git URI
   */
  app.post("/api/git/parse", async (req, res, next) => {
    try {
      const { uri } = req.body;

      if (!uri) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: uri",
        });
      }

      logger.debug(`API: Parsing Git URI: ${uri}`);

      const result = await getItemFromGit(uri);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/git/config/:id
   * Update Git config for a document
   */
  app.post("/api/git/config/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const gitConfig = req.body as GitConfig;

      if (!gitConfig) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: gitConfig",
        });
      }

      logger.debug(`API: Updating Git config for: ${id}`);

      const result = await setCollectionItem(id, gitConfig);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Models Routes
  // ============================================

  /**
   * POST /api/models/update
   * Update model list from provider APIs
   */
  app.post("/api/models/update", async (req, res, next) => {
    try {
      const { provider, modelsFile, dryRun } = req.body;

      logger.debug(`API: Updating model list for provider: ${provider || "all"}`);

      const result = await updateModelList({
        provider,
        modelsFile,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/models/upload
   * Upload models to Firestore
   */
  app.post("/api/models/upload", async (req, res, next) => {
    try {
      const { modelsFile, collection, dryRun } = req.body;

      logger.debug("API: Uploading models to Firestore");

      const result = await uploadModels({
        modelsFile,
        collection,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // Plugins Routes
  // ============================================

  /**
   * POST /api/plugins/discover
   * Discover MCP servers from GitHub repository
   */
  app.post("/api/plugins/discover", async (req, res, next) => {
    try {
      const { githubUrl, outputFile, agent, skipAI, dryRun } = req.body;

      if (!githubUrl) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: githubUrl",
        });
      }

      logger.debug(`API: Discovering MCP servers from: ${githubUrl}`);

      const result = await discoverMCPServers({
        githubUrl,
        outputFile,
        agent,
        skipAI,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/plugins/upload
   * Upload plugins to Firestore
   */
  app.post("/api/plugins/upload", async (req, res, next) => {
    try {
      const { libraryFile, organizationId, docId, dryRun } = req.body;

      if (!libraryFile || !organizationId || !docId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: libraryFile, organizationId, docId",
        });
      }

      logger.debug("API: Uploading plugins to Firestore");

      const result = await uploadPlugins({
        libraryFile,
        organizationId,
        docId,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/firebase/create-user
   * Create Firebase user with profile and actor documents
   */
  app.post("/api/firebase/create-user", async (req, res, next) => {
    try {
      const { email, password, dryRun } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: email, password",
        });
      }

      logger.debug("API: Creating Firebase user");

      const result = await createUser({
        email,
        password,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/firebase/copy-projects
   * Copy Firestore documents between projects with user ID replacement
   */
  app.post("/api/firebase/copy-projects", async (req, res, next) => {
    try {
      const {
        sourceServiceAccountPath,
        destServiceAccountPath,
        collections,
        userIdMapFile,
        dryRun,
        verbose,
      } = req.body;

      if (!sourceServiceAccountPath || !destServiceAccountPath) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: sourceServiceAccountPath, destServiceAccountPath",
        });
      }

      logger.debug("API: Copying Firebase projects");

      const result = await copyProjects({
        sourceServiceAccountPath,
        destServiceAccountPath,
        collections,
        userIdMapFile,
        dryRun,
        verbose,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/binaries/upload
   * Upload binaries to Firebase Storage
   */
  app.post("/api/binaries/upload", async (req, res, next) => {
    try {
      const { platform, version, directory, dryRun } = req.body;

      logger.debug("API: Uploading binaries to Firebase Storage");

      const result = await uploadBinaries({
        platform: platform || "all",
        version: version || "latest",
        directory: directory || "./dist",
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/managed/generate
   * Generate managed server directory
   */
  app.post("/api/managed/generate", async (req, res, next) => {
    try {
      const {
        directory,
        workstationId,
        organizationId,
        apiPort,
        name,
        dryRun,
      } = req.body;

      if (!directory || !workstationId || !organizationId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: directory, workstationId, organizationId",
        });
      }

      logger.debug("API: Generating managed server");

      const result = await generateManagedServer({
        directory,
        workstationId,
        organizationId,
        apiPort: apiPort || 3021,
        name: name || "Managed Workspace",
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/managed/build
   * Build Docker image for managed server
   */
  app.post("/api/managed/build", async (req, res, next) => {
    try {
      const { directory, dryRun } = req.body;

      if (!directory) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: directory",
        });
      }

      logger.debug("API: Building Docker image for managed server");

      const result = await buildDockerImage({
        directory,
        dryRun,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Start listening
  const port = config.API_SERVER_PORT;

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`API server listening on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`API base: http://localhost:${port}/api`);
      resolve();
    });
  });
}
