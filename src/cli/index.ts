#!/usr/bin/env node
import { Command } from "commander";
import { createLogger } from "../utils/logger.js";
import { loadConfig } from "../config.js";

// Import command handlers
import { configCommand } from "./commands/config.js";
import { modelsCommand } from "./commands/models.js";
import { pluginsCommand } from "./commands/plugins.js";
import { firebaseCommand } from "./commands/firebase.js";
import { binariesCommand } from "./commands/binaries.js";
import { managedCommand } from "./commands/managed.js";

const logger = createLogger("cli");

const program = new Command();

program
  .name("taw-utils")
  .description("TAW Utils CLI - Firebase config management and AI model utilities")
  .version("2.0.0");

// ============================================
// Config Management Commands
// ============================================
const config = program
  .command("config")
  .description("Manage Firebase config collection");

config
  .command("list")
  .description("List all config documents")
  .action(async () => {
    await configCommand.list();
  });

config
  .command("get <id>")
  .description("Get a config document by ID")
  .action(async (id: string) => {
    await configCommand.get(id);
  });

config
  .command("set <id>")
  .description("Create or update a config document")
  .option("-f, --file <path>", "Read data from JSON file")
  .option("-d, --data <json>", "Data as JSON string")
  .option("--no-merge", "Overwrite instead of merge")
  .action(async (id: string, options) => {
    await configCommand.set(id, options);
  });

config
  .command("validate")
  .description("Validate configuration and environment variables")
  .action(async () => {
    await configCommand.validate();
  });

// ============================================
// Health Check Command
// ============================================
program
  .command("health")
  .description("Check Firebase connection and configuration")
  .action(async () => {
    try {
      logger.info("Running health check...");
      const config = loadConfig();
      logger.info("✓ Configuration loaded successfully");
      logger.info(`  Firebase Project: ${config.FIREBASE_PROJECT_ID}`);
      logger.info(`  Service Account: ${config.FIREBASE_SERVICE_ACCOUNT_PATH}`);

      // Try to initialize Firebase
      const { initializeFirebase } = await import("../utils/firebase.js");
      initializeFirebase();
      logger.info("✓ Firebase initialized successfully");

      logger.info("\n✓ All health checks passed");
    } catch (error) {
      logger.error("✗ Health check failed:", error);
      process.exit(1);
    }
  });

// ============================================
// Model Management Commands
// ============================================
const models = program
  .command("models")
  .description("Manage AI model configurations");

models
  .command("list")
  .description("List all models from local file")
  .option("-f, --models-file <path>", "Models file path", "config/models.json")
  .action(async (options) => {
    await modelsCommand.list(options);
  });

models
  .command("update")
  .description("Update model list from provider APIs")
  .option("-p, --provider <provider>", "Provider to update (openai, anthropic, google, mistral, ollama, all)", "all")
  .option("-f, --models-file <path>", "Models file path", "config/models.json")
  .option("--dry-run", "Preview without writing")
  .action(async (options) => {
    await modelsCommand.update(options);
  });

models
  .command("upload")
  .description("Upload models to Firestore")
  .option("-f, --models-file <path>", "Models file path", "config/models.json")
  .option("-c, --collection <name>", "Firestore collection", "config")
  .option("--dry-run", "Preview without uploading")
  .action(async (options) => {
    await modelsCommand.upload(options);
  });

// ============================================
// Plugin Management Commands
// ============================================
const plugins = program
  .command("plugins")
  .description("Manage MCP server plugins");

plugins
  .command("list")
  .description("List plugins from library file")
  .option("-l, --library <path>", "Library file path", "config/library.json")
  .action(async (options) => {
    await pluginsCommand.list(options);
  });

plugins
  .command("discover <url>")
  .description("Discover MCP servers from GitHub repository")
  .option("-o, --output <path>", "Output file path", "config/library-discovered.json")
  .option("-a, --agent <name>", "AI agent to use", "agent_research")
  .option("--skip-ai", "Skip AI analysis (faster, less accurate)")
  .option("--dry-run", "Preview without writing")
  .action(async (url: string, options) => {
    await pluginsCommand.discover({ url, ...options });
  });

plugins
  .command("upload")
  .description("Upload plugins to Firestore")
  .requiredOption("-l, --library <path>", "Library file path")
  .requiredOption("-o, --org <id>", "Organization ID (* for global)")
  .requiredOption("-d, --doc-id <id>", "Document ID (must start with plugin-mcp-)")
  .option("--dry-run", "Preview without uploading")
  .action(async (options) => {
    await pluginsCommand.upload(options);
  });

// ============================================
// Firebase Management Commands
// ============================================
const firebase = program
  .command("firebase")
  .description("Firebase management utilities");

firebase
  .command("create-user <email> <password>")
  .description("Create Firebase user with profile and actor documents")
  .option("--dry-run", "Preview without creating")
  .action(async (email: string, password: string, options) => {
    await firebaseCommand.createUser({ email, password, dryRun: options.dryRun });
  });

firebase
  .command("copy-projects")
  .description("Copy Firestore documents between projects with user ID replacement")
  .requiredOption("-s, --source <path>", "Source service account path")
  .requiredOption("-d, --dest <path>", "Destination service account path")
  .option("-c, --collections <list>", "Comma-separated collection names")
  .option("-m, --user-id-map <path>", "User ID mapping file")
  .option("--dry-run", "Preview without copying")
  .option("--verbose", "Detailed logging")
  .action(async (options) => {
    await firebaseCommand.copyProjects(options);
  });

// ============================================
// Managed Server Commands
// ============================================
const managed = program
  .command("managed")
  .description("Managed server deployment");

managed
  .command("generate")
  .description("Generate managed server directory with Docker configuration")
  .requiredOption("-d, --directory <path>", "Output directory")
  .requiredOption("-w, --workstation-id <id>", "Workstation ID")
  .requiredOption("-o, --organization-id <id>", "Organization ID")
  .option("-p, --api-port <port>", "API port", "3021")
  .option("-n, --name <name>", "Workspace name", "Managed Workspace")
  .option("--dry-run", "Preview without creating")
  .action(async (options) => {
    await managedCommand.generate({
      directory: options.directory,
      workstationId: options.workstationId,
      organizationId: options.organizationId,
      apiPort: parseInt(options.apiPort),
      name: options.name,
      dryRun: options.dryRun,
    });
  });

managed
  .command("build")
  .description("Build Docker image for managed server")
  .requiredOption("-d, --directory <path>", "Managed server directory")
  .option("--dry-run", "Preview without building")
  .action(async (options) => {
    await managedCommand.build(options);
  });

// ============================================
// Binary Upload Commands
// ============================================
const binaries = program
  .command("binaries")
  .description("Binary distribution management");

binaries
  .command("upload")
  .description("Upload binaries to Firebase Storage")
  .option("-p, --platform <platform>", "Platform (mac, linux, windows, all)", "all")
  .option("-v, --version <version>", "Version tag", "latest")
  .option("-d, --directory <path>", "Build directory", "./dist")
  .option("--dry-run", "Preview without uploading")
  .action(async (options) => {
    await binariesCommand.upload(options);
  });

// Parse arguments and execute
program.parse();
