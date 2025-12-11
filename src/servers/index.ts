#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { startMCPServer } from "./mcp.js";
import { startAPIServer } from "./api.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("launcher");

/**
 * Main entry point for server launcher
 * Starts MCP and/or API servers based on configuration
 */
async function main() {
  try {
    logger.info("TAW Utils Server Launcher v2.0.0");
    logger.info("==================================");

    // Load configuration
    const config = loadConfig();

    logger.info("Configuration loaded successfully");
    logger.info(`Environment: ${config.NODE_ENV}`);

    const servers: Promise<void>[] = [];

    // Start MCP server if enabled
    if (config.MCP_SERVER_ENABLED) {
      if (config.MCP_SERVER_PORT === 0) {
        logger.info("MCP Server: stdio mode (port disabled)");
        servers.push(startMCPServer(config));
      } else {
        logger.info(`MCP Server: enabled (port ${config.MCP_SERVER_PORT}, transport: ${config.MCP_TRANSPORT})`);
        servers.push(startMCPServer(config));
      }
    } else {
      logger.info("MCP Server: disabled");
    }

    // Start API server if enabled
    if (config.API_SERVER_ENABLED) {
      if (config.API_SERVER_PORT === 0) {
        logger.info("API Server: disabled (port = 0)");
      } else {
        logger.info(`API Server: enabled (port ${config.API_SERVER_PORT})`);
        if (config.API_AUTH_ENABLED) {
          logger.info("API Authentication: enabled");
        } else {
          logger.warn("API Authentication: disabled (not recommended for production)");
        }
        servers.push(startAPIServer(config));
      }
    } else {
      logger.info("API Server: disabled");
    }

    // Check if any servers are enabled
    if (servers.length === 0) {
      logger.error("No servers enabled. Please check your configuration.");
      logger.error("Set MCP_SERVER_ENABLED=true or API_SERVER_ENABLED=true");
      logger.error("And ensure ports are not set to 0 (except MCP which defaults to stdio)");
      process.exit(1);
    }

    logger.info(`Starting ${servers.length} server(s)...`);

    // Wait for all servers to start
    await Promise.all(servers);

    logger.info("All servers started successfully");
  } catch (error) {
    logger.error("Fatal error starting servers:", error);
    process.exit(1);
  }
}

// Handle process signals
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
