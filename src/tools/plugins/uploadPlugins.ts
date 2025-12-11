/**
 * Upload Plugins to Firestore
 * Uploads MCP plugin library to Firestore config collection
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getFirestore } from "../../utils/firebase.js";
import { createLogger } from "../../utils/logger.js";
import type {
  ToolResult,
  UploadPluginsOptions,
  MCPServerConfig,
  PluginLibrary,
} from "../../types/index.js";

const logger = createLogger("tools:plugins:upload");

interface UploadSummary {
  pluginCount: number;
  organizationId: string;
  docId: string;
  samplePlugins: string[];
}

/**
 * Load plugin library from JSON file
 */
function loadLibraryJson(libraryFile: string): Record<string, MCPServerConfig> {
  const resolvedPath = resolve(process.cwd(), libraryFile);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Library file not found: ${resolvedPath}`);
  }

  try {
    const fileContent = readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(fileContent);

    // Extract plugins from 'mcp' key
    const plugins = data.mcp || {};
    if (Object.keys(plugins).length === 0) {
      throw new Error("No plugins found in 'mcp' key of library file");
    }

    return plugins as Record<string, MCPServerConfig>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${libraryFile}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate document ID naming convention
 */
function validateDocId(docId: string): void {
  if (!docId.startsWith("plugin-mcp-")) {
    throw new Error(
      "Document ID must start with 'plugin-mcp-'\n" +
        "Example: plugin-mcp-core, plugin-mcp-discovered, plugin-mcp-org-abc"
    );
  }
}

/**
 * Upload plugins to Firestore
 */
export async function uploadPlugins(
  options: UploadPluginsOptions
): Promise<ToolResult<UploadSummary>> {
  const { libraryFile, organizationId, docId, dryRun = false } = options;

  try {
    // Validate document ID
    validateDocId(docId);

    logger.info(`Loading plugins from: ${libraryFile}`);

    // Load plugins
    const plugins = loadLibraryJson(libraryFile);
    const pluginCount = Object.keys(plugins).length;
    logger.info(`Loaded ${pluginCount} plugins`);

    const collection = "config";

    // Dry run mode - just show what would be uploaded
    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No data will be uploaded ===");

      logger.info(`Would upload document to '${collection}/${docId}':`);
      logger.info(`  type: 'plugin-mcp'`);
      logger.info(`  organizationId: '${organizationId}'`);
      logger.info(`  mcp: ${pluginCount} plugins`);

      const pluginKeys = Object.keys(plugins);
      const samplePlugins = pluginKeys.slice(0, 5);
      samplePlugins.forEach((key) => logger.info(`    - ${key}`));

      if (pluginCount > 5) {
        logger.info(`    ... and ${pluginCount - 5} more plugins`);
      }

      return {
        success: true,
        data: {
          pluginCount,
          organizationId,
          docId,
          samplePlugins: pluginKeys.slice(0, 3),
        },
        message: "Dry run completed - no data uploaded",
      };
    }

    // Actually upload to Firestore
    logger.info(`Uploading to Firestore collection '${collection}'...`);
    logger.info(`  Document ID: ${docId}`);
    logger.info(`  Organization: ${organizationId}`);

    const db = getFirestore();

    // Create document with plugin-mcp structure
    const documentData: PluginLibrary = {
      type: "plugin-mcp",
      organizationId,
      mcp: plugins,
    };

    // Upload the document
    const docRef = db.collection(collection).doc(docId);
    await docRef.set(documentData);

    logger.info(
      `✓ Successfully uploaded ${pluginCount} plugins to '${docId}'`
    );

    // Log sample plugins
    const pluginKeys = Object.keys(plugins);
    const samplePlugins = pluginKeys.slice(0, 3);
    logger.info(`  Sample plugins: ${samplePlugins.join(", ")}`);
    if (pluginCount > 3) {
      logger.info(`  ... and ${pluginCount - 3} more`);
    }

    return {
      success: true,
      data: {
        pluginCount,
        organizationId,
        docId,
        samplePlugins,
      },
      message: `Uploaded ${pluginCount} plugins to ${collection}/${docId}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error("Failed to upload plugins:", errorMessage);
    return {
      success: false,
      error: `Failed to upload plugins: ${errorMessage}`,
    };
  }
}
