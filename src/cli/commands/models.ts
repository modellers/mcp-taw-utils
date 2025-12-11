import { createLogger } from "../../utils/logger.js";
import { updateModelList, uploadModels } from "../../tools/models/index.js";

const logger = createLogger("cli:models");

/**
 * Models command handlers
 */
export const modelsCommand = {
  /**
   * Update model list from provider APIs
   */
  async update(options: {
    provider?: string;
    modelsFile?: string;
    dryRun?: boolean;
  }): Promise<void> {
    try {
      logger.info("Updating model list...");

      const result = await updateModelList({
        provider: options.provider as any,
        modelsFile: options.modelsFile,
        dryRun: options.dryRun,
      });

      if (result.success && result.data) {
        logger.info(`\n✓ ${result.message}\n`);
        console.log(`Providers: ${result.data.providers.join(", ")}`);
        console.log(`Models Added: ${result.data.modelsAdded}`);
        console.log(`Models Updated: ${result.data.modelsUpdated}`);
        console.log(`Output File: ${result.data.outputFile}`);
      } else {
        logger.error("Failed to update models:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error updating models:", error);
      process.exit(1);
    }
  },

  /**
   * Upload models to Firestore
   */
  async upload(options: {
    modelsFile?: string;
    collection?: string;
    dryRun?: boolean;
  }): Promise<void> {
    try {
      logger.info("Uploading models to Firestore...");

      const result = await uploadModels({
        modelsFile: options.modelsFile,
        collection: options.collection,
        dryRun: options.dryRun,
      });

      if (result.success && result.data) {
        logger.info(`\n✓ ${result.message}\n`);

        console.log(`Total Models: ${result.data.totalModels}`);
        console.log(`Provider Groups: ${result.data.providerCount}\n`);

        result.data.providers.forEach((provider) => {
          console.log(`📦 ${provider.docName}`);
          console.log(`   Models: ${provider.modelCount}`);
          console.log(`   Sample: ${provider.sampleModels.join(", ")}`);
          console.log();
        });

        if (options.dryRun) {
          console.log(
            "💡 Run without --dry-run to actually upload the models"
          );
        }
      } else {
        logger.error("Failed to upload models:", result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error("Error uploading models:", error);
      process.exit(1);
    }
  },

  /**
   * List models (placeholder)
   */
  async list(options: { modelsFile?: string }): Promise<void> {
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { resolve } = await import("path");

      const modelsFile = options.modelsFile || "config/models.json";
      const resolvedPath = resolve(process.cwd(), modelsFile);

      if (!existsSync(resolvedPath)) {
        logger.error(`Models file not found: ${resolvedPath}`);
        process.exit(1);
      }

      const fileContent = readFileSync(resolvedPath, "utf-8");
      const data = JSON.parse(fileContent);
      const models = data.type === "models" && data.models ? data.models : data;

      logger.info(`\nModels in ${modelsFile}:\n`);

      // Group by provider
      const providers: Record<string, string[]> = {};
      for (const modelKey of Object.keys(models)) {
        if (modelKey.includes("/")) {
          const provider = modelKey.split("/")[0];
          if (!providers[provider]) providers[provider] = [];
          providers[provider].push(modelKey);
        }
      }

      for (const [provider, modelList] of Object.entries(providers)) {
        console.log(`\n📦 ${provider} (${modelList.length} models):`);
        modelList.slice(0, 10).forEach((model) => console.log(`   - ${model}`));
        if (modelList.length > 10) {
          console.log(`   ... and ${modelList.length - 10} more`);
        }
      }

      console.log(`\nTotal: ${Object.keys(models).length} models\n`);
    } catch (error) {
      logger.error("Error listing models:", error);
      process.exit(1);
    }
  },
};
