import { readFileSync } from "fs";
import { createLogger } from "../../utils/logger.js";
import { loadConfig } from "../../config.js";
import {
  listCollection,
  getCollection,
  setCollection,
} from "../../tools/config/index.js";

const logger = createLogger("cli:config");

/**
 * Config command handlers
 */
export const configCommand = {
  /**
   * List all config documents
   */
  async list(): Promise<void> {
    try {
      logger.info("Listing config documents...");

      const result = await listCollection();

      if (result.success && result.data) {
        logger.info(`\nFound ${result.data.length} document(s):\n`);

        result.data.forEach((doc) => {
          console.log(`📄 ${doc.id}`);
          if (doc.data.type) {
            console.log(`   Type: ${doc.data.type}`);
          }
          if (doc.data.organizationId) {
            console.log(`   Org: ${doc.data.organizationId}`);
          }
          console.log();
        });
      } else {
        logger.error("Failed to list documents:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error listing documents:", error);
      process.exit(1);
    }
  },

  /**
   * Get a config document by ID
   */
  async get(id: string): Promise<void> {
    try {
      logger.info(`Getting document: ${id}`);

      const result = await getCollection(id);

      if (result.success) {
        if (result.data) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          logger.warn(`Document '${id}' not found`);
          process.exit(1);
        }
      } else {
        logger.error("Failed to get document:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error getting document:", error);
      process.exit(1);
    }
  },

  /**
   * Create or update a config document
   */
  async set(
    id: string,
    options: { file?: string; data?: string; merge: boolean }
  ): Promise<void> {
    try {
      logger.info(`Setting document: ${id}`);

      let data: Record<string, unknown>;

      // Get data from file or command line
      if (options.file) {
        logger.debug(`Reading data from file: ${options.file}`);
        const fileContent = readFileSync(options.file, "utf-8");
        data = JSON.parse(fileContent);
      } else if (options.data) {
        logger.debug("Parsing data from command line");
        data = JSON.parse(options.data);
      } else {
        logger.error("Either --file or --data must be provided");
        process.exit(1);
      }

      const result = await setCollection(id, data, options.merge);

      if (result.success) {
        logger.info(`✓ ${result.message}`);
      } else {
        logger.error("Failed to set document:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error setting document:", error);
      process.exit(1);
    }
  },

  /**
   * Validate configuration
   */
  async validate(): Promise<void> {
    try {
      logger.info("Validating configuration...\n");

      const config = loadConfig();

      console.log("✓ Configuration is valid\n");

      console.log("Firebase Configuration:");
      console.log(`  Project ID: ${config.FIREBASE_PROJECT_ID}`);
      console.log(`  Storage Bucket: ${config.FIREBASE_STORAGE_BUCKET}`);
      console.log(`  Service Account: ${config.FIREBASE_SERVICE_ACCOUNT_PATH}`);
      console.log();

      console.log("Server Configuration:");
      console.log(`  MCP Enabled: ${config.MCP_SERVER_ENABLED}`);
      if (config.MCP_SERVER_ENABLED) {
        console.log(
          `  MCP Port: ${config.MCP_SERVER_PORT === 0 ? "disabled (stdio only)" : config.MCP_SERVER_PORT}`
        );
        console.log(`  MCP Transport: ${config.MCP_TRANSPORT}`);
      }
      console.log(`  API Enabled: ${config.API_SERVER_ENABLED}`);
      if (config.API_SERVER_ENABLED) {
        console.log(
          `  API Port: ${config.API_SERVER_PORT === 0 ? "disabled" : config.API_SERVER_PORT}`
        );
        console.log(`  API Auth: ${config.API_AUTH_ENABLED}`);
      }
      console.log();

      console.log("Optional Configuration:");
      console.log(`  LanceDB Path: ${config.LANCEDB_PATH || "not set"}`);
      console.log(
        `  API Base URL: ${config.API_BASE_URL || "not set"}`
      );
      console.log(`  Node Environment: ${config.NODE_ENV || "not set"}`);
      console.log(`  Log Level: ${config.LOG_LEVEL || "not set"}`);
      console.log();

      console.log("API Keys:");
      console.log(`  OpenAI: ${config.OPENAI_API_KEY ? "✓ set" : "✗ not set"}`);
      console.log(`  Anthropic: ${config.ANTHROPIC_API_KEY ? "✓ set" : "✗ not set"}`);
      console.log(`  Google: ${config.GOOGLE_API_KEY ? "✓ set" : "✗ not set"}`);
      console.log(`  Mistral: ${config.MISTRAL_API_KEY ? "✓ set" : "✗ not set"}`);
      console.log(`  GitHub: ${config.GITHUB_TOKEN ? "✓ set" : "✗ not set"}`);
      console.log();

      logger.info("✓ All checks passed");
    } catch (error) {
      logger.error("Configuration validation failed:", error);
      process.exit(1);
    }
  },
};
