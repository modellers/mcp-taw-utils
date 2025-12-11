/**
 * Discover MCP Servers
 * AI-powered discovery of MCP servers from GitHub repositories
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createLogger } from "../../utils/logger.js";
import { getConfig } from "../../config.js";
import type {
  ToolResult,
  DiscoverOptions,
  MCPServerConfig,
  DiscoveryMetadata,
} from "../../types/index.js";

const logger = createLogger("tools:plugins:discover");

interface RepositoryData {
  readme?: string;
  packageJson?: any;
  requirementsTxt?: string;
  cargoToml?: string;
  goMod?: string;
}

interface DiscoveredPlugin {
  config: MCPServerConfig;
  metadata: DiscoveryMetadata;
  repositoryData: RepositoryData;
}

interface DiscoverySummary {
  serversDiscovered: number;
  confidenceAvg: number;
  warnings: string[];
  outputFile?: string;
  plugins: Record<string, DiscoveredPlugin>;
}

/**
 * Parse GitHub URL to extract owner, repo, and optional subpath
 */
function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  subpath?: string;
} {
  // Handle various formats:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo/tree/main/subpath
  // - github.com/owner/repo
  const match = url.match(
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/[^\/]+\/(.+))?/
  );

  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
    subpath: match[3],
  };
}

/**
 * Fetch GitHub repository metadata
 */
async function fetchGitHubRepo(
  owner: string,
  repo: string,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch file contents from GitHub
 */
async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null; // File not found
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Detect MCP server configuration from repository
 */
async function detectMCPConfig(
  owner: string,
  repo: string,
  subpath: string | undefined,
  repoInfo: any,
  token?: string
): Promise<{ config: MCPServerConfig; metadata: DiscoveryMetadata; repositoryData: RepositoryData }> {
  const warnings: string[] = [];
  let confidence = 0.5; // Base confidence

  // Fetch package.json
  const packageJsonPath = subpath ? `${subpath}/package.json` : "package.json";
  const packageJsonContent = await fetchGitHubFile(
    owner,
    repo,
    packageJsonPath,
    token
  );

  let packageJson: any = {};
  let packageName = `@${owner}/${repo}`;

  if (packageJsonContent) {
    try {
      packageJson = JSON.parse(packageJsonContent);
      packageName = packageJson.name || packageName;
      confidence += 0.2; // Found package.json
    } catch (error) {
      warnings.push("Could not parse package.json");
    }
  } else {
    warnings.push("No package.json found");
  }

  // Fetch README
  const readmePaths = ["README.md", "readme.md", "Readme.md"];
  let readme = "";
  for (const readmePath of readmePaths) {
    const path = subpath ? `${subpath}/${readmePath}` : readmePath;
    const content = await fetchGitHubFile(owner, repo, path, token);
    if (content) {
      readme = content;
      confidence += 0.1; // Found README
      break;
    }
  }

  // Extract description
  let description = repoInfo.description || "";
  if (packageJson.description) {
    description = packageJson.description;
  }

  // Detect MCP server indicators
  const isMCPServer =
    readme.toLowerCase().includes("mcp server") ||
    readme.toLowerCase().includes("model context protocol") ||
    packageJson.keywords?.includes("mcp") ||
    packageJson.keywords?.includes("model-context-protocol");

  if (isMCPServer) {
    confidence += 0.2;
  } else {
    warnings.push("No explicit MCP server indicators found");
  }

  // Determine runtime and command
  let runtime: MCPServerConfig["runtime"] = {
    type: "node",
    package: packageName,
  };
  let command = "npx";
  let args = ["-y", packageName];

  // Check for bin entry in package.json
  if (packageJson.bin) {
    const binName = typeof packageJson.bin === "string"
      ? packageName.split("/").pop()
      : Object.keys(packageJson.bin)[0];
    args = ["-y", packageName];
    confidence += 0.1;
  }

  // Detect Python MCP servers
  if (packageJson.dependencies?.["mcp"] || readme.toLowerCase().includes("python")) {
    const hasPythonFiles = readme.includes("```python") || readme.includes(".py");
    if (hasPythonFiles) {
      runtime = {
        type: "python",
        package: repo,
      };
      command = "python";
      args = ["-m", repo];
      warnings.push("Python runtime detected - may need manual adjustment");
    }
  }

  // Build config
  const config: MCPServerConfig = {
    name: repo,
    description: description || `MCP server from ${owner}/${repo}`,
    transport: "stdio", // Default, may need manual verification
    command,
    args,
    runtime,
    tags: ["discovered", ...(packageJson.keywords || [])],
    verified: false,
  };

  // Add env vars if detected in README
  const envVarPattern = /([A-Z_]+)=([^\s]+)/g;
  const envVars = readme.match(envVarPattern);
  if (envVars && envVars.length > 0) {
    config.env = {};
    warnings.push("Environment variables detected - review required");
  }

  const metadata: DiscoveryMetadata = {
    source: `https://github.com/${owner}/${repo}${subpath ? `/tree/main/${subpath}` : ""}`,
    confidence: Math.min(confidence, 1.0),
    warnings,
    discoveredAt: new Date().toISOString(),
  };

  // Fetch language-specific dependency files
  const repositoryData: RepositoryData = {
    readme,
    packageJson,
  };

  // Python: requirements.txt
  if (runtime.type === "python" || readme.toLowerCase().includes("python")) {
    const reqPath = subpath ? `${subpath}/requirements.txt` : "requirements.txt";
    const requirementsTxt = await fetchGitHubFile(owner, repo, reqPath, token);
    if (requirementsTxt) {
      repositoryData.requirementsTxt = requirementsTxt;
    }
  }

  // Rust: Cargo.toml
  if (readme.toLowerCase().includes("rust") || readme.toLowerCase().includes("cargo")) {
    const cargoPath = subpath ? `${subpath}/Cargo.toml` : "Cargo.toml";
    const cargoToml = await fetchGitHubFile(owner, repo, cargoPath, token);
    if (cargoToml) {
      repositoryData.cargoToml = cargoToml;
    }
  }

  // Go: go.mod
  if (readme.toLowerCase().includes("golang") || readme.toLowerCase().includes("go ")) {
    const goModPath = subpath ? `${subpath}/go.mod` : "go.mod";
    const goMod = await fetchGitHubFile(owner, repo, goModPath, token);
    if (goMod) {
      repositoryData.goMod = goMod;
    }
  }

  return { config, metadata, repositoryData };
}

/**
 * Discover MCP servers from a GitHub repository
 *
 * Fetches repository metadata, package.json, and README to extract MCP server configuration
 */
export async function discoverMCPServers(
  options: DiscoverOptions
): Promise<ToolResult<DiscoverySummary>> {
  const {
    githubUrl,
    batchFile,
    outputFile = "config/library-discovered.json",
    agent = "agent_research",
    skipAI = false,
    dryRun = false,
  } = options;

  try {
    const config = getConfig();

    if (!githubUrl && !batchFile) {
      throw new Error("Either githubUrl or batchFile must be provided");
    }

    const urlsToProcess: string[] = [];

    if (githubUrl) {
      urlsToProcess.push(githubUrl);
    }

    // TODO: Read batch file if provided
    if (batchFile) {
      logger.warn("Batch file processing not yet implemented");
    }

    logger.info(
      `Discovering MCP servers from ${urlsToProcess.length} repository(ies)...`
    );

    const discoveredPlugins: Record<string, DiscoveredPlugin> = {};
    const warnings: string[] = [];

    for (const url of urlsToProcess) {
      try {
        const parsed = parseGitHubUrl(url);
        logger.info(`Processing: ${parsed.owner}/${parsed.repo}`);

        // Fetch repository information
        logger.info("  Fetching repository metadata...");
        const repoInfo = await fetchGitHubRepo(
          parsed.owner,
          parsed.repo,
          config.GITHUB_TOKEN
        );

        // Detect MCP configuration
        logger.info("  Analyzing repository for MCP server configuration...");
        const { config: mcpConfig, metadata, repositoryData } = await detectMCPConfig(
          parsed.owner,
          parsed.repo,
          parsed.subpath,
          repoInfo,
          config.GITHUB_TOKEN
        );

        const pluginKey = parsed.repo;
        discoveredPlugins[pluginKey] = {
          config: mcpConfig,
          metadata,
          repositoryData,
        };

        logger.info(
          `  ✓ Discovered: ${mcpConfig.name} (confidence: ${(metadata.confidence * 100).toFixed(0)}%)`
        );

        if (metadata.warnings.length > 0) {
          warnings.push(`${pluginKey}: ${metadata.warnings.join(", ")}`);
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        logger.error(`Failed to process ${url}:`, errorMsg);
        warnings.push(`${url}: ${errorMsg}`);
      }
    }

    const serversDiscovered = Object.keys(discoveredPlugins).length;
    const confidenceAvg =
      serversDiscovered > 0
        ? Object.values(discoveredPlugins).reduce(
            (sum, p) => sum + p.metadata.confidence,
            0
          ) / serversDiscovered
        : 0.0;

    // Dry run
    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No file will be written ===");
      logger.info(`Discovered ${serversDiscovered} server(s)`);

      return {
        success: true,
        data: {
          serversDiscovered,
          confidenceAvg,
          warnings,
          plugins: discoveredPlugins,
        },
        message: "Dry run completed - no file written",
      };
    }

    // Write output file
    if (outputFile) {
      const resolvedPath = resolve(process.cwd(), outputFile);

      // Create library format
      const libraryData = {
        mcp: Object.fromEntries(
          Object.entries(discoveredPlugins).map(([key, plugin]) => [
            key,
            {
              ...plugin.config,
              _discovery: plugin.metadata,
              _repository: plugin.repositoryData,
            },
          ])
        ),
      };

      writeFileSync(resolvedPath, JSON.stringify(libraryData, null, 2));
      logger.info(`✓ Wrote discovered plugins to: ${resolvedPath}`);

      return {
        success: true,
        data: {
          serversDiscovered,
          confidenceAvg,
          warnings,
          outputFile: resolvedPath,
          plugins: discoveredPlugins,
        },
        message: `Discovered ${serversDiscovered} servers (stub)`,
      };
    }

    return {
      success: true,
      data: {
        serversDiscovered,
        confidenceAvg,
        warnings,
        plugins: discoveredPlugins,
      },
      message: `Discovered ${serversDiscovered} servers (stub)`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error("Failed to discover MCP servers:", errorMessage);
    return {
      success: false,
      error: `Failed to discover MCP servers: ${errorMessage}`,
    };
  }
}
