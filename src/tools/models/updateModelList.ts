/**
 * Update Model List
 * Fetch latest AI models from provider APIs and update local configuration
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createLogger } from "../../utils/logger.js";
import { getConfig } from "../../config.js";
import type { ToolResult, UpdateModelsOptions, Model } from "../../types/index.js";

const logger = createLogger("tools:models:update");

interface UpdateSummary {
  modelsAdded: number;
  modelsUpdated: number;
  providers: string[];
  outputFile: string;
}

/**
 * Update model list from provider APIs
 *
 * Note: This is a stub implementation. Full implementation would:
 * 1. Call OpenAI API to get models
 * 2. Use known Anthropic models (no public API)
 * 3. Call Google Generative AI API
 * 4. Call Mistral API
 * 5. Query Ollama (localhost:11434)
 */
export async function updateModelList(
  options: UpdateModelsOptions
): Promise<ToolResult<UpdateSummary>> {
  const {
    provider = "all",
    modelsFile = "config/models.json",
    dryRun = false,
  } = options;

  try {
    const config = getConfig();
    const resolvedPath = resolve(process.cwd(), modelsFile);

    logger.info(`Updating model list for provider: ${provider}`);

    // Load existing models if file exists
    let existingModels: Record<string, Model> = {};
    if (existsSync(resolvedPath)) {
      try {
        const fileContent = readFileSync(resolvedPath, "utf-8");
        const data = JSON.parse(fileContent);
        existingModels =
          data.type === "models" && data.models ? data.models : data;
        logger.info(`Loaded ${Object.keys(existingModels).length} existing models`);
      } catch (error) {
        logger.warn("Could not load existing models, starting fresh");
      }
    }

    const providersToUpdate: string[] = [];
    let modelsAdded = 0;
    let modelsUpdated = 0;

    // Determine which providers to update
    if (provider === "all") {
      if (config.OPENAI_API_KEY) providersToUpdate.push("openai");
      if (config.ANTHROPIC_API_KEY) providersToUpdate.push("anthropic");
      if (config.GOOGLE_API_KEY) providersToUpdate.push("google");
      if (config.MISTRAL_API_KEY) providersToUpdate.push("mistral");
      providersToUpdate.push("ollama"); // No key needed
    } else {
      providersToUpdate.push(provider);
    }

    logger.info(`Updating providers: ${providersToUpdate.join(", ")}`);

    // Fetch models from each provider
    const updatedModels: Record<string, Model> = { ...existingModels };

    for (const prov of providersToUpdate) {
      try {
        logger.info(`Fetching models from ${prov}...`);
        const newModels = await fetchProviderModels(prov, config);

        for (const [key, model] of Object.entries(newModels)) {
          if (existingModels[key]) {
            modelsUpdated++;
            logger.info(`  Updated: ${key}`);
          } else {
            modelsAdded++;
            logger.info(`  Added: ${key}`);
          }
          updatedModels[key] = model;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to fetch ${prov} models: ${errorMessage}`);
      }
    }

    // Dry run
    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No file will be written ===");
      logger.info(`Would add ${modelsAdded} models, update ${modelsUpdated} models`);
      return {
        success: true,
        data: {
          modelsAdded,
          modelsUpdated,
          providers: providersToUpdate,
          outputFile: resolvedPath,
        },
        message: "Dry run completed - no changes made",
      };
    }

    // Write updated models
    const outputData = {
      type: "models",
      models: updatedModels,
    };

    writeFileSync(resolvedPath, JSON.stringify(outputData, null, 2));
    logger.info(`Wrote ${Object.keys(updatedModels).length} models to ${resolvedPath}`);

    const summary: UpdateSummary = {
      modelsAdded,
      modelsUpdated,
      providers: providersToUpdate,
      outputFile: resolvedPath,
    };

    logger.info(`Model list update completed`);

    return {
      success: true,
      data: summary,
      message: `Added ${modelsAdded} models, updated ${modelsUpdated} models`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error("Failed to update model list:", errorMessage);
    return {
      success: false,
      error: `Failed to update model list: ${errorMessage}`,
    };
  }
}

/**
 * Fetch models from a specific provider
 */
async function fetchProviderModels(
  provider: string,
  config: ReturnType<typeof getConfig>
): Promise<Record<string, Model>> {
  const models: Record<string, Model> = {};

  switch (provider) {
    case "openai":
      if (!config.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not set");
      }
      return await fetchOpenAIModels(config.OPENAI_API_KEY);

    case "anthropic":
      // Anthropic has no public API - use known models
      return getAnthropicModels();

    case "google":
      if (!config.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY not set");
      }
      return await fetchGoogleModels(config.GOOGLE_API_KEY);

    case "mistral":
      if (!config.MISTRAL_API_KEY) {
        throw new Error("MISTRAL_API_KEY not set");
      }
      return await fetchMistralModels(config.MISTRAL_API_KEY);

    case "ollama":
      return await fetchOllamaModels();

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Fetch OpenAI models
 */
async function fetchOpenAIModels(apiKey: string): Promise<Record<string, Model>> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { data: any[] };
  const models: Record<string, Model> = {};

  for (const model of data.data) {
    if (model.id.startsWith("gpt-") || model.id.startsWith("o1-")) {
      const key = `openai/${model.id}`;
      models[key] = {
        model_name: model.id,
        initiator: "openai",
        name: model.id.toUpperCase(),
        description: `OpenAI ${model.id} model`,
        family: model.id.startsWith("gpt-4") ? "gpt-4" : model.id.startsWith("o1") ? "o1" : "gpt-3.5",
        type: "chat",
        tags: ["openai", "chat"],
        version: 1,
        url: "https://api.openai.com/v1",
        api_endpoint: "https://api.openai.com/v1/chat/completions",
        access_key: "OPENAI_API_KEY",
        config: {
          max_tokens: 4096,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
        score: {
          reasoning: 0.9,
          coding: 0.85,
          reliability: 0.95,
        },
        pricing: {
          input_per_1m_tokens: 10,
          output_per_1m_tokens: 30,
        },
      };
    }
  }

  return models;
}

/**
 * Get known Anthropic models (no public API)
 */
function getAnthropicModels(): Record<string, Model> {
  return {
    "anthropic/claude-3-opus-20240229": {
      model_name: "claude-3-opus-20240229",
      initiator: "anthropic",
      name: "Claude 3 Opus",
      description: "Most capable Claude model for complex tasks",
      family: "claude-3",
      type: "chat",
      tags: ["anthropic", "claude", "chat"],
      version: 1,
      url: "https://api.anthropic.com",
      api_endpoint: "https://api.anthropic.com/v1/messages",
      access_key: "ANTHROPIC_API_KEY",
      config: {
        max_tokens: 4096,
        temperature: 1,
        top_p: 1,
      },
      score: {
        reasoning: 0.95,
        coding: 0.9,
        reliability: 0.95,
      },
      pricing: {
        input_per_1m_tokens: 15000,
        output_per_1m_tokens: 75000,
      },
    },
    "anthropic/claude-3-sonnet-20240229": {
      model_name: "claude-3-sonnet-20240229",
      initiator: "anthropic",
      name: "Claude 3 Sonnet",
      description: "Balanced performance and speed",
      family: "claude-3",
      type: "chat",
      tags: ["anthropic", "claude", "chat"],
      version: 1,
      url: "https://api.anthropic.com",
      api_endpoint: "https://api.anthropic.com/v1/messages",
      access_key: "ANTHROPIC_API_KEY",
      config: {
        max_tokens: 4096,
        temperature: 1,
        top_p: 1,
      },
      score: {
        reasoning: 0.9,
        coding: 0.85,
        reliability: 0.95,
      },
      pricing: {
        input_per_1m_tokens: 3000,
        output_per_1m_tokens: 15000,
      },
    },
    "anthropic/claude-3-haiku-20240307": {
      model_name: "claude-3-haiku-20240307",
      initiator: "anthropic",
      name: "Claude 3 Haiku",
      description: "Fastest and most compact Claude model",
      family: "claude-3",
      type: "chat",
      tags: ["anthropic", "claude", "chat"],
      version: 1,
      url: "https://api.anthropic.com",
      api_endpoint: "https://api.anthropic.com/v1/messages",
      access_key: "ANTHROPIC_API_KEY",
      config: {
        max_tokens: 4096,
        temperature: 1,
        top_p: 1,
      },
      score: {
        reasoning: 0.85,
        coding: 0.8,
        reliability: 0.95,
      },
      pricing: {
        input_per_1m_tokens: 250,
        output_per_1m_tokens: 1250,
      },
    },
  };
}

/**
 * Fetch Google Generative AI models
 */
async function fetchGoogleModels(apiKey: string): Promise<Record<string, Model>> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { models?: any[] };
  const models: Record<string, Model> = {};

  for (const model of data.models || []) {
    if (model.name.includes("gemini")) {
      const modelId = model.name.split("/").pop();
      const key = `google/${modelId}`;
      models[key] = {
        model_name: modelId,
        initiator: "google",
        name: model.displayName || modelId,
        description: model.description || `Google ${modelId} model`,
        family: "gemini",
        type: "chat",
        tags: ["google", "gemini", "chat"],
        version: 1,
        url: "https://generativelanguage.googleapis.com",
        api_endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
        access_key: "GOOGLE_API_KEY",
        config: {
          max_tokens: 2048,
          temperature: 0.9,
          top_p: 1,
        },
        score: {
          reasoning: 0.85,
          coding: 0.8,
          reliability: 0.9,
        },
        pricing: {
          input_per_1m_tokens: 350,
          output_per_1m_tokens: 1050,
        },
      };
    }
  }

  return models;
}

/**
 * Fetch Mistral models
 */
async function fetchMistralModels(apiKey: string): Promise<Record<string, Model>> {
  const response = await fetch("https://api.mistral.ai/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { data?: any[] };
  const models: Record<string, Model> = {};

  for (const model of data.data || []) {
    const key = `mistral/${model.id}`;
    models[key] = {
      model_name: model.id,
      initiator: "mistral",
      name: model.id,
      description: `Mistral ${model.id} model`,
      family: "mistral",
      type: "chat",
      tags: ["mistral", "chat"],
      version: 1,
      url: "https://api.mistral.ai",
      api_endpoint: "https://api.mistral.ai/v1/chat/completions",
      access_key: "MISTRAL_API_KEY",
      config: {
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 1,
      },
      score: {
        reasoning: 0.85,
        coding: 0.8,
        reliability: 0.9,
      },
      pricing: {
        input_per_1m_tokens: 1000,
        output_per_1m_tokens: 3000,
      },
    };
  }

  return models;
}

/**
 * Fetch Ollama models (local)
 */
async function fetchOllamaModels(): Promise<Record<string, Model>> {
  try {
    const response = await fetch("http://localhost:11434/api/tags");

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { models?: any[] };
    const models: Record<string, Model> = {};

    for (const model of data.models || []) {
      const key = `ollama/${model.name}`;
      models[key] = {
        model_name: model.name,
        initiator: "ollama",
        name: model.name,
        description: `Ollama ${model.name} model (local)`,
        family: "ollama",
        type: "chat",
        tags: ["ollama", "local", "chat"],
        version: 1,
        url: "http://localhost:11434",
        api_endpoint: "http://localhost:11434/api/generate",
        access_key: "",
        config: {
          max_tokens: 2048,
          temperature: 0.8,
          top_p: 0.9,
        },
        score: {
          reasoning: 0.7,
          coding: 0.7,
          reliability: 0.85,
        },
        pricing: {
          input_per_1m_tokens: 0,
          output_per_1m_tokens: 0,
        },
      };
    }

    return models;
  } catch (error) {
    // Ollama might not be running
    logger.warn("Ollama not available (is it running on localhost:11434?)");
    return {};
  }
}
