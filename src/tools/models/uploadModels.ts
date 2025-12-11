/**
 * Upload Models to Firestore
 * Uploads AI model configurations to Firestore config collection, grouped by provider
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getFirestore } from "../../utils/firebase.js";
import { createLogger } from "../../utils/logger.js";
import type {
  ToolResult,
  UploadModelsOptions,
  Model,
  ModelsDocument,
} from "../../types/index.js";

const logger = createLogger("tools:models:upload");

interface ProviderGroups {
  [docName: string]: Record<string, Model>;
}

interface UploadSummary {
  totalModels: number;
  providerCount: number;
  providers: Array<{
    docName: string;
    modelCount: number;
    sampleModels: string[];
  }>;
}

/**
 * Load models from JSON file
 * Handles both wrapped {type: "models", models: {...}} and flat format
 */
function loadModelsJson(modelsFile: string): Record<string, Model> {
  const resolvedPath = resolve(process.cwd(), modelsFile);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Models file not found: ${resolvedPath}`);
  }

  try {
    const fileContent = readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(fileContent);

    // Handle wrapped format {type: "models", models: {...}}
    if (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      "models" in data
    ) {
      logger.debug(`Detected wrapped format with type='${data.type}'`);
      return data.models as Record<string, Model>;
    }

    // Handle old flat format
    return data as Record<string, Model>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${modelsFile}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Group models by their provider prefix
 * e.g., "openai/gpt-4" -> provider group "models-openai"
 */
function groupModelsByProvider(
  models: Record<string, Model>
): ProviderGroups {
  const providerGroups: ProviderGroups = {};

  for (const [modelKey, modelData] of Object.entries(models)) {
    // Extract provider from model key (e.g., "openai/gpt-4" -> "openai")
    if (modelKey.includes("/")) {
      const provider = modelKey.split("/")[0];
      const docName = `models-${provider}`;

      if (!providerGroups[docName]) {
        providerGroups[docName] = {};
      }

      providerGroups[docName][modelKey] = modelData;
    } else {
      logger.warn(
        `Skipping model '${modelKey}' - no provider prefix found`
      );
    }
  }

  return providerGroups;
}

/**
 * Upload models to Firestore
 */
export async function uploadModels(
  options: UploadModelsOptions
): Promise<ToolResult<UploadSummary>> {
  const {
    modelsFile = "config/models.json",
    collection = "config",
    dryRun = false,
  } = options;

  try {
    logger.info(`Loading models from: ${modelsFile}`);

    // Load models
    const models = loadModelsJson(modelsFile);
    const totalModels = Object.keys(models).length;
    logger.info(`Loaded ${totalModels} total models`);

    // Group by provider
    logger.info("Grouping models by provider...");
    const providerGroups = groupModelsByProvider(models);
    const providerCount = Object.keys(providerGroups).length;

    logger.info(`Found ${providerCount} provider groups:`);
    for (const [docName, models] of Object.entries(providerGroups)) {
      logger.info(`  - ${docName}: ${Object.keys(models).length} models`);
    }

    // Dry run mode - just show what would be uploaded
    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No data will be uploaded ===");

      const summary: UploadSummary = {
        totalModels,
        providerCount,
        providers: [],
      };

      for (const [docName, models] of Object.entries(providerGroups)) {
        const modelKeys = Object.keys(models);
        const modelCount = modelKeys.length;

        logger.info(`Would upload document to '${collection}/${docName}':`);
        logger.info(`  type: 'models'`);
        logger.info(`  models: ${modelCount} models`);

        const sampleModels = modelKeys.slice(0, 5);
        sampleModels.forEach((key) => logger.info(`    - ${key}`));

        if (modelCount > 5) {
          logger.info(`    ... and ${modelCount - 5} more models`);
        }

        summary.providers.push({
          docName,
          modelCount,
          sampleModels: modelKeys.slice(0, 3),
        });
      }

      return {
        success: true,
        data: summary,
        message: "Dry run completed - no data uploaded",
      };
    }

    // Actually upload to Firestore
    logger.info(`Uploading to Firestore collection '${collection}'...`);
    const db = getFirestore();

    const summary: UploadSummary = {
      totalModels,
      providerCount,
      providers: [],
    };

    for (const [docName, models] of Object.entries(providerGroups)) {
      const modelKeys = Object.keys(models);
      const modelCount = modelKeys.length;

      logger.info(
        `Uploading ${modelCount} models to '${collection}/${docName}'...`
      );

      // Wrap models in proper document structure with type attribute
      const documentData: ModelsDocument = {
        type: "models",
        models: models,
      };

      // Upload the document
      const docRef = db.collection(collection).doc(docName);
      await docRef.set(documentData);

      logger.info(
        `✓ Successfully uploaded ${modelCount} models to '${docName}'`
      );

      // Log sample models
      const sampleModels = modelKeys.slice(0, 3);
      logger.info(`  Sample models: ${sampleModels.join(", ")}`);
      if (modelCount > 3) {
        logger.info(`  ... and ${modelCount - 3} more`);
      }

      summary.providers.push({
        docName,
        modelCount,
        sampleModels,
      });
    }

    logger.info(
      `✓ Successfully uploaded all models to '${collection}' collection!`
    );

    return {
      success: true,
      data: summary,
      message: `Uploaded ${totalModels} models across ${providerCount} providers`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error("Failed to upload models:", errorMessage);
    return {
      success: false,
      error: `Failed to upload models: ${errorMessage}`,
    };
  }
}
