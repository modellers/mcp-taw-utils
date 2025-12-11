import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// Load .env file
dotenvConfig();

export interface Config {
  // Firebase Configuration
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_SERVICE_ACCOUNT_PATH: string;
  FIREBASE_SOURCE_KEY_PATH?: string;
  FIREBASE_DEST_KEY_PATH?: string;

  // AI Service API Keys (Optional)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  PREMAI_API_KEY?: string;
  TAVILY_API_KEY?: string;
  GITHUB_TOKEN?: string;

  // Server Configuration
  MCP_SERVER_ENABLED: boolean;
  MCP_SERVER_PORT: number;
  MCP_TRANSPORT: "stdio" | "sse" | "both";
  API_SERVER_ENABLED: boolean;
  API_SERVER_PORT: number;
  API_AUTH_ENABLED: boolean;
  API_KEY?: string;

  // Optional Configuration
  LANCEDB_PATH?: string;
  USER_ID_MAP: Record<string, string>;
  API_BASE_URL?: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
}

/**
 * Parse a boolean environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Parse an integer environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
}

/**
 * Parse JSON environment variable
 */
function parseJSON<T>(value: string | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    console.error(`Failed to parse JSON from env var, using default`);
    return defaultValue;
  }
}

/**
 * Resolve service account path
 * Tries multiple locations in order of preference
 */
function resolveServiceAccountPath(): string {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (envPath) {
    const resolvedPath = resolve(process.cwd(), envPath);
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
    console.warn(`Service account path from env not found: ${resolvedPath}`);
  }

  // Fallback paths (in order of preference)
  const fallbackPaths = [
    "./secrets/tasking-agency-serviceaccount.json",
    "./secrets/tasking-agency-serviceaccount-is.json",
    "./secrets/ta-dev-admin-service-account.json",
    "./secrets/ta-is-admin-service-account.json",
  ];

  for (const path of fallbackPaths) {
    const resolvedPath = resolve(process.cwd(), path);
    if (existsSync(resolvedPath)) {
      console.warn(
        `Using discovered service account: ${path} (set FIREBASE_SERVICE_ACCOUNT_PATH to suppress this warning)`
      );
      return resolvedPath;
    }
  }

  throw new Error(
    `Firebase service account not found. Please:\n` +
      `1. Set FIREBASE_SERVICE_ACCOUNT_PATH environment variable, or\n` +
      `2. Place service account JSON at one of:\n` +
      fallbackPaths.map((p) => `   - ${p}`).join("\n")
  );
}

/**
 * Validate required configuration
 */
function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Required fields
  if (!config.FIREBASE_PROJECT_ID) {
    errors.push("FIREBASE_PROJECT_ID is required");
  }

  if (!config.FIREBASE_STORAGE_BUCKET) {
    errors.push("FIREBASE_STORAGE_BUCKET is required");
  }

  if (!config.FIREBASE_SERVICE_ACCOUNT_PATH) {
    errors.push("FIREBASE_SERVICE_ACCOUNT_PATH could not be resolved");
  }

  // Server configuration validation
  if (!config.MCP_SERVER_ENABLED && !config.API_SERVER_ENABLED) {
    errors.push("At least one server (MCP or API) must be enabled");
  }

  if (config.MCP_SERVER_PORT < 0 || config.MCP_SERVER_PORT > 65535) {
    errors.push("MCP_SERVER_PORT must be between 0 and 65535");
  }

  if (config.API_SERVER_PORT < 0 || config.API_SERVER_PORT > 65535) {
    errors.push("API_SERVER_PORT must be between 0 and 65535");
  }

  if (!["stdio", "sse", "both"].includes(config.MCP_TRANSPORT)) {
    errors.push("MCP_TRANSPORT must be 'stdio', 'sse', or 'both'");
  }

  if (config.API_AUTH_ENABLED && !config.API_KEY) {
    errors.push("API_KEY is required when API_AUTH_ENABLED is true");
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\n` +
        `Please check your .env file or environment variables.`
    );
  }
}

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  const config: Config = {
    // Firebase
    FIREBASE_PROJECT_ID:
      process.env.FIREBASE_PROJECT_ID || "tasking-agency-is",
    FIREBASE_STORAGE_BUCKET:
      process.env.FIREBASE_STORAGE_BUCKET || "tasking-agency-is.appspot.com",
    FIREBASE_SERVICE_ACCOUNT_PATH: resolveServiceAccountPath(),
    FIREBASE_SOURCE_KEY_PATH: process.env.FIREBASE_SOURCE_KEY_PATH,
    FIREBASE_DEST_KEY_PATH: process.env.FIREBASE_DEST_KEY_PATH,

    // AI Service API Keys
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    PREMAI_API_KEY: process.env.PREMAI_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,

    // Server Configuration
    MCP_SERVER_ENABLED: parseBool(process.env.MCP_SERVER_ENABLED, true),
    MCP_SERVER_PORT: parseInt(process.env.MCP_SERVER_PORT, 3023),
    MCP_TRANSPORT: (process.env.MCP_TRANSPORT as "stdio" | "sse" | "both") || "stdio",
    API_SERVER_ENABLED: parseBool(process.env.API_SERVER_ENABLED, true),
    API_SERVER_PORT: parseInt(process.env.API_SERVER_PORT, 3004),
    API_AUTH_ENABLED: parseBool(process.env.API_AUTH_ENABLED, false),
    API_KEY: process.env.API_KEY,

    // Optional Configuration
    LANCEDB_PATH: process.env.LANCEDB_PATH || "./.lancedb",
    USER_ID_MAP: parseJSON(process.env.USER_ID_MAP, {}),
    API_BASE_URL: process.env.API_BASE_URL || "http://localhost:3021",
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
  };

  validateConfig(config);

  return config;
}

/**
 * Get a singleton config instance
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
