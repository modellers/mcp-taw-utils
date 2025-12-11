/**
 * Plugins Tools
 * MCP server plugin discovery and management
 */

export * from "./uploadPlugins.js";
export * from "./discoverPlugins.js";

// Re-export types for convenience
export type {
  MCPServerConfig,
  PluginLibrary,
  DiscoverOptions,
  UploadPluginsOptions,
} from "../../types/index.js";
