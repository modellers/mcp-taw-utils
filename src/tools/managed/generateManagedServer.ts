import { createLogger } from "../../utils/logger.js";
import type { ToolResult } from "../../types/index.js";
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const logger = createLogger("tools:managed:generate");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface GenerateManagedServerOptions {
  directory: string;
  workstationId: string;
  organizationId: string;
  apiPort?: number;
  name?: string;
  dryRun?: boolean;
}

export interface GenerateManagedServerResult {
  directory: string;
  workstationId: string;
  organizationId: string;
  apiPort: number;
  filesCreated: string[];
}

/**
 * Generate isolated Docker-based managed server configuration
 * Converts bin/managed/generate-server.py to TypeScript
 */
export async function generateManagedServer(
  options: GenerateManagedServerOptions
): Promise<ToolResult<GenerateManagedServerResult>> {
  const {
    directory,
    workstationId,
    organizationId,
    apiPort = 3021,
    name = "Managed Workspace",
    dryRun = false,
  } = options;

  try {
    logger.info(`Generating managed server: ${workstationId}`);

    const targetDir = resolve(process.cwd(), directory);
    const projectRoot = resolve(process.cwd());
    const templatesDir = resolve(projectRoot, "bin/managed");

    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No files will be created ===");
      logger.info(`Would create directory: ${targetDir}`);
      logger.info(`  Workstation ID: ${workstationId}`);
      logger.info(`  Organization ID: ${organizationId}`);
      logger.info(`  API Port: ${apiPort}`);
      logger.info(`  Name: ${name}`);

      return {
        success: true,
        data: {
          directory: targetDir,
          workstationId,
          organizationId,
          apiPort,
          filesCreated: [],
        },
        message: "Dry run completed - no files created",
      };
    }

    // Check if directory already exists
    if (existsSync(targetDir)) {
      return {
        success: false,
        error: `Directory already exists: ${targetDir}`,
      };
    }

    // Validate templates exist
    const dockerfileTemplate = join(templatesDir, "Dockerfile.template");
    const dockerComposeTemplate = join(templatesDir, "docker-compose.template.yml");
    const configTemplate = join(templatesDir, "config.template.yaml");

    if (!existsSync(dockerfileTemplate)) {
      return {
        success: false,
        error: `Dockerfile template not found: ${dockerfileTemplate}`,
      };
    }

    if (!existsSync(dockerComposeTemplate)) {
      return {
        success: false,
        error: `docker-compose template not found: ${dockerComposeTemplate}`,
      };
    }

    if (!existsSync(configTemplate)) {
      return {
        success: false,
        error: `config template not found: ${configTemplate}`,
      };
    }

    const filesCreated: string[] = [];

    // Create directory structure
    logger.info("Creating directory structure...");
    const directories = ["config", "logs", ".lancedb", "files"];

    mkdirSync(targetDir, { recursive: true });
    filesCreated.push(targetDir);

    for (const dir of directories) {
      const dirPath = join(targetDir, dir);
      mkdirSync(dirPath, { recursive: true });
      filesCreated.push(dirPath);
      logger.info(`  ✓ ${dir}/`);
    }

    // Create empty workstation.json
    const workstationJsonPath = join(targetDir, "config", "workstation.json");
    writeFileSync(
      workstationJsonPath,
      JSON.stringify({ servers: {} }, null, 2)
    );
    filesCreated.push(workstationJsonPath);
    logger.info("  ✓ config/workstation.json");

    // Copy Dockerfile
    logger.info("Copying Dockerfile...");
    const dockerfileDst = join(targetDir, "Dockerfile");
    copyFileSync(dockerfileTemplate, dockerfileDst);
    filesCreated.push(dockerfileDst);
    logger.info("  ✓ Dockerfile");

    // Generate docker-compose.yml
    logger.info("Generating docker-compose.yml...");
    let dockerComposeContent = readFileSync(dockerComposeTemplate, "utf-8");
    dockerComposeContent = dockerComposeContent
      .replace(/\{\{WORKSTATION_ID\}\}/g, workstationId)
      .replace(/\{\{API_PORT\}\}/g, apiPort.toString())
      .replace(/\{\{PROJECT_ROOT\}\}/g, projectRoot)
      .replace(/\{\{MANAGED_DIR\}\}/g, targetDir);

    const dockerComposePath = join(targetDir, "docker-compose.yml");
    writeFileSync(dockerComposePath, dockerComposeContent);
    filesCreated.push(dockerComposePath);
    logger.info(`  ✓ Container: ${workstationId}`);
    logger.info(`  ✓ Port: ${apiPort} → 3021`);

    // Generate config.yaml
    logger.info("Generating config/config.yaml...");
    let configContent = readFileSync(configTemplate, "utf-8");
    configContent = configContent
      .replace(/\{\{WORKSTATION_ID\}\}/g, workstationId)
      .replace(/\{\{ORGANIZATION_ID\}\}/g, organizationId)
      .replace(/\{\{API_PORT\}\}/g, apiPort.toString())
      .replace(/\{\{WORKSPACE_NAME\}\}/g, name);

    const configPath = join(targetDir, "config", "config.yaml");
    writeFileSync(configPath, configContent);
    filesCreated.push(configPath);
    logger.info(`  ✓ Workspace: ${name}`);
    logger.info(`  ✓ Organization: ${organizationId}`);

    // Create README.md
    logger.info("Creating README.md...");
    const readmeContent = generateReadme(workstationId, organizationId, apiPort);
    const readmePath = join(targetDir, "README.md");
    writeFileSync(readmePath, readmeContent);
    filesCreated.push(readmePath);
    logger.info("  ✓ README.md");

    logger.info(`\n✅ Managed server generated successfully!`);
    logger.info(`   Directory: ${targetDir}`);
    logger.info(`   Files created: ${filesCreated.length}`);
    logger.info(`\nNext steps:`);
    logger.info(`   1. cd ${directory}`);
    logger.info(`   2. Edit config/config.yaml (add credentials)`);
    logger.info(`   3. docker-compose up -d`);

    return {
      success: true,
      data: {
        directory: targetDir,
        workstationId,
        organizationId,
        apiPort,
        filesCreated,
      },
      message: `Managed server generated: ${workstationId}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate managed server: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to generate managed server: ${errorMessage}`,
    };
  }
}

/**
 * Generate README content for managed server
 */
function generateReadme(
  workstationId: string,
  organizationId: string,
  apiPort: number
): string {
  return `# Managed Server: ${workstationId}

This is a managed Tasking Agency server configured for isolated operation.

## Configuration

- **Workstation ID**: \`${workstationId}\`
- **Organization ID**: \`${organizationId}\`
- **API Port**: \`${apiPort}\`

## Setup

### 1. Configure Credentials

Edit \`config/config.yaml\` and fill in the required fields:

\`\`\`yaml
agency:
  username: "your-email@example.com"    # Firebase email
  password: "your-password"              # Firebase password
  api_server: "your-project-id"          # Firebase Project ID
  api_key: "AIza..."                     # Firebase Web API Key

ai_services:
  openai: "sk-..."                       # At least one AI service key required
  # OR
  anthropic: "sk-ant-..."
  # OR
  google: "AIza..."
\`\`\`

### 2. Add Workspace Files (Optional)

Place any files your agents need to access in the \`files/\` directory:

\`\`\`bash
cp mydata.json files/
cp -r documents/ files/
\`\`\`

### 3. Start Server

\`\`\`bash
docker-compose up -d
\`\`\`

### 4. Verify

\`\`\`bash
curl http://localhost:${apiPort}/api/status
\`\`\`

## Management

\`\`\`bash
# View logs
docker-compose logs -f

# Stop server
docker-compose stop

# Restart server
docker-compose restart

# Remove server
docker-compose down
\`\`\`

## Persistent Data

The following directories contain persistent data:

- \`config/\` - Configuration files
- \`logs/\` - Application logs
- \`.lancedb/\` - Vector database
- \`files/\` - Agent workspace files

## API Endpoints

- \`GET /api/status\` - Server health
- \`GET /api/agents\` - List agents
- \`POST /api/agents/{id}/chat\` - Chat with agent
- \`GET /api/models/available\` - Available models
- \`GET /api-docs\` - API documentation

## Troubleshooting

**Container won't start:**
\`\`\`bash
docker-compose logs
\`\`\`

**Port already in use:**
\`\`\`bash
lsof -i :${apiPort}
# Kill process or change port in docker-compose.yml
\`\`\`

**Permission errors:**
\`\`\`bash
chmod -R 755 config/ logs/ .lancedb/ files/
\`\`\`

For more information, see the main project documentation.
`;
}
