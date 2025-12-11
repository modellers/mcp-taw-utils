import { createLogger } from "../../utils/logger.js";
import { discoverMCPServers, uploadPlugins } from "../../tools/plugins/index.js";

const logger = createLogger("cli:plugins");

/**
 * Plugins command handlers
 */
export const pluginsCommand = {
  /**
   * Discover MCP servers from GitHub repository
   */
  async discover(options: {
    url: string;
    output?: string;
    agent?: string;
    skipAi?: boolean;
    dryRun?: boolean;
  }): Promise<void> {
    try {
      logger.info(`Discovering MCP server from: ${options.url}`);

      const result = await discoverMCPServers({
        githubUrl: options.url,
        outputFile: options.output,
        agent: options.agent,
        skipAI: options.skipAi,
        dryRun: options.dryRun,
      });

      if (result.success && result.data) {
        logger.info(`\n✓ ${result.message}\n`);

        console.log(`Servers Discovered: ${result.data.serversDiscovered}`);
        console.log(`Average Confidence: ${result.data.confidenceAvg.toFixed(2)}`);

        if (result.data.warnings.length > 0) {
          console.log(`\n⚠️  Warnings:`);
          result.data.warnings.forEach((warning) => console.log(`  - ${warning}`));
        }

        if (result.data.outputFile) {
          console.log(`\nOutput written to: ${result.data.outputFile}`);
        }

        if (options.dryRun) {
          console.log("\n💡 Run without --dry-run to write the output file");
        }
      } else {
        logger.error("Failed to discover plugins:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error discovering plugins:", error);
      process.exit(1);
    }
  },

  /**
   * Upload plugins to Firestore
   */
  async upload(options: {
    library: string;
    org: string;
    docId: string;
    dryRun?: boolean;
  }): Promise<void> {
    try {
      logger.info("Uploading plugins to Firestore...");

      const result = await uploadPlugins({
        libraryFile: options.library,
        organizationId: options.org,
        docId: options.docId,
        dryRun: options.dryRun,
      });

      if (result.success && result.data) {
        logger.info(`\n✓ ${result.message}\n`);

        console.log(`📦 Plugin Library Upload`);
        console.log(`   Document ID: ${result.data.docId}`);
        console.log(`   Organization: ${result.data.organizationId}`);
        console.log(`   Plugin Count: ${result.data.pluginCount}`);
        console.log(`   Sample Plugins: ${result.data.samplePlugins.join(", ")}`);

        if (options.dryRun) {
          console.log("\n💡 Run without --dry-run to actually upload the plugins");
        }
      } else {
        logger.error("Failed to upload plugins:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error uploading plugins:", error);
      process.exit(1);
    }
  },

  /**
   * List plugins from library file
   */
  async list(options: { library?: string }): Promise<void> {
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { resolve } = await import("path");

      const libraryFile = options.library || "config/library.json";
      const resolvedPath = resolve(process.cwd(), libraryFile);

      if (!existsSync(resolvedPath)) {
        logger.error(`Library file not found: ${resolvedPath}`);
        process.exit(1);
      }

      const fileContent = readFileSync(resolvedPath, "utf-8");
      const data = JSON.parse(fileContent);
      const plugins = data.mcp || {};

      logger.info(`\nPlugins in ${libraryFile}:\n`);

      // Group by category if available
      const categories: Record<string, string[]> = { uncategorized: [] };

      for (const [key, plugin] of Object.entries(plugins)) {
        const config = plugin as any;
        const category = config.category || "uncategorized";
        if (!categories[category]) categories[category] = [];
        categories[category].push(key);
      }

      for (const [category, pluginList] of Object.entries(categories)) {
        if (pluginList.length === 0) continue;

        console.log(`\n📦 ${category} (${pluginList.length} plugins):`);
        pluginList.slice(0, 10).forEach((plugin) => console.log(`   - ${plugin}`));
        if (pluginList.length > 10) {
          console.log(`   ... and ${pluginList.length - 10} more`);
        }
      }

      console.log(`\nTotal: ${Object.keys(plugins).length} plugins\n`);
    } catch (error) {
      logger.error("Error listing plugins:", error);
      process.exit(1);
    }
  },
};
