/**
 * Shared TypeScript type definitions for the TAW Utils project
 */

// ============================================
// Common Types
// ============================================

export interface ToolOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// Model Types
// ============================================

export interface ModelScore {
  math?: number;
  reasoning?: number;
  coding?: number;
  price?: number;
  creativity?: number;
  safety?: number;
  helpfulness?: number;
  reliability?: number;
  // Raw benchmarks
  GSM8K?: number;
  MMLU?: number;
  HumanEval?: number;
  MBPP?: number;
  ARC?: number;
  HellaSwag?: number;
}

export interface ModelPricing {
  input_per_1m_tokens: number;
  output_per_1m_tokens: number;
  last_updated?: string;
  source_url?: string;
}

export interface ModelConfig {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  [key: string]: unknown;
}

export interface Model {
  model_name: string;
  initiator: string;
  name: string;
  description: string;
  family: string;
  type: "chat" | "completion" | "embedding";
  tags: string[];
  version: number;
  url: string;
  api_endpoint: string;
  access_key: string;
  config: ModelConfig;
  score: ModelScore;
  pricing: ModelPricing;
}

export interface ModelsDocument {
  type: "models";
  models: Record<string, Model>;
}

export interface UpdateModelsOptions extends ToolOptions {
  provider?: "openai" | "anthropic" | "google" | "mistral" | "ollama" | "all";
  modelsFile?: string;
}

export interface UploadModelsOptions extends ToolOptions {
  modelsFile?: string;
  collection?: string;
}

// ============================================
// Plugin Types
// ============================================

export interface MCPServerRuntime {
  type: "node" | "python" | "binary";
  package?: string;
  version?: string;
}

export interface MCPServerCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  streaming?: boolean;
}

export interface MCPServerAuthentication {
  type: "none" | "bearer" | "api_key" | "oauth";
  tokenEnvVar?: string;
  [key: string]: unknown;
}

export interface MCPServerSetup {
  requirements?: string[];
  instructions?: string;
}

export interface MCPServerConfig {
  name: string;
  description?: string;
  category?: string;
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  runtime?: MCPServerRuntime;
  capabilities?: MCPServerCapabilities;
  authentication?: MCPServerAuthentication;
  setup?: MCPServerSetup;
  tags?: string[];
  verified?: boolean;
  version?: string;
}

export interface PluginLibrary {
  type: "plugin-mcp";
  organizationId: string;
  mcp: Record<string, MCPServerConfig>;
}

export interface DiscoveryMetadata {
  source: string;
  confidence: number;
  warnings: string[];
  discoveredAt: string;
}

export interface DiscoverOptions extends ToolOptions {
  githubUrl?: string;
  batchFile?: string;
  outputFile?: string;
  agent?: string;
  skipAI?: boolean;
}

export interface UploadPluginsOptions extends ToolOptions {
  libraryFile: string;
  organizationId: string;
  docId: string;
}

// ============================================
// Firebase Types
// ============================================

export interface FirebaseProfile {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  organizationId: string;
  read: Record<string, number>;
  write: Record<string, number>;
  project: Record<string, unknown>;
  activeProjects?: string[];
  menuTasks?: string[];
  menuChats?: string[];
  deleted?: boolean;
  created: number;
  updated: number;
}

export interface FirebaseActor {
  id: string;
  alias: string;
  motivation: string;
  organizationId: string;
  systemPrompt: string;
  language: string;
  workspaces: string[];
  tools: Record<string, string[] | Record<string, string[]>>;
  model: string[];
  roles?: Record<string, unknown>;
  systemValues: Record<string, unknown>;
  read: Record<string, number>;
  write: Record<string, number>;
  imageURL: string;
  createdAt: string;
}

export interface CopyProjectsOptions extends ToolOptions {
  collections?: string[];
  userIdMap?: Record<string, string>;
}

export interface CreateUserOptions extends ToolOptions {
  email: string;
  password: string;
}

// ============================================
// Managed Server Types
// ============================================

export interface ManagedServerConfig {
  directory: string;
  workstationId: string;
  organizationId: string;
  apiPort?: number;
  name?: string;
}

export interface GenerateManagedServerOptions extends ToolOptions {
  directory: string;
  workstationId: string;
  organizationId: string;
  apiPort?: number;
  name?: string;
}

export interface BuildDockerOptions extends ToolOptions {
  directory: string;
}

// ============================================
// Binary Types
// ============================================

export type Platform = "mac" | "linux" | "windows" | "all";

export interface BinaryUploadInfo {
  platform: Platform;
  arch: string;
  filePath: string;
  storagePath: string;
  downloadUrl?: string;
}

export interface UploadBinariesOptions extends ToolOptions {
  platform?: Platform;
  version?: string;
}

// ============================================
// Config Collection Types (Existing)
// ============================================

export interface GitConfig {
  uri: string;
  type: string;
  parsedAt: string;
  host?: string;
  path?: string;
  protocol?: string;
  owner?: string;
  repo?: string;
}

export type DocumentData = Record<string, unknown>;
