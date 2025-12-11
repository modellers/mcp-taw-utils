import { createLogger } from "../../utils/logger.js";
import type { ToolResult } from "../../types/index.js";
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from "fs";
import { resolve, join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const logger = createLogger("tools:managed:build");

export interface BuildDockerImageOptions {
  directory: string;
  dryRun?: boolean;
}

export interface BuildDockerImageResult {
  directory: string;
  buildSuccess: boolean;
  buildOutput?: string;
}

/**
 * Build Docker image for a managed server
 * Converts bin/managed/build-docker.sh to TypeScript
 */
export async function buildDockerImage(
  options: BuildDockerImageOptions
): Promise<ToolResult<BuildDockerImageResult>> {
  const { directory, dryRun = false } = options;

  try {
    logger.info(`Building Docker image for managed server`);

    const managedDir = resolve(process.cwd(), directory);
    const projectRoot = resolve(process.cwd());

    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No Docker build will run ===");
      logger.info(`Would build image for: ${managedDir}`);
      logger.info(`  Project root: ${projectRoot}`);
      logger.info(`  Steps:`);
      logger.info(`    1. Validate managed directory`);
      logger.info(`    2. Check dist/ exists`);
      logger.info(`    3. Backup .dockerignore`);
      logger.info(`    4. Run docker-compose build`);
      logger.info(`    5. Restore .dockerignore`);

      return {
        success: true,
        data: {
          directory: managedDir,
          buildSuccess: true,
          buildOutput: "Dry run - no build executed",
        },
        message: "Dry run completed - no Docker build executed",
      };
    }

    // Validate managed directory
    logger.info("Validating managed directory...");
    if (!existsSync(managedDir)) {
      return {
        success: false,
        error: `Directory not found: ${managedDir}`,
      };
    }

    const dockerfilePath = join(managedDir, "Dockerfile");
    if (!existsSync(dockerfilePath)) {
      return {
        success: false,
        error: `No Dockerfile found in ${managedDir}`,
      };
    }

    const dockerComposePath = join(managedDir, "docker-compose.yml");
    if (!existsSync(dockerComposePath)) {
      return {
        success: false,
        error: `No docker-compose.yml found in ${managedDir}`,
      };
    }

    logger.info("  ✓ Dockerfile found");
    logger.info("  ✓ docker-compose.yml found");

    // Check if dist/ exists
    logger.info("Checking for compiled code...");
    const distDir = join(projectRoot, "dist");
    if (!existsSync(distDir)) {
      return {
        success: false,
        error: `dist/ not found in project root. Run 'npm run build' first.`,
      };
    }
    logger.info("  ✓ dist/ found");

    // Backup and modify .dockerignore
    const dockerignorePath = join(projectRoot, ".dockerignore");
    const dockerignoreBackup = join(projectRoot, ".dockerignore.backup");
    let dockerignoreBackedUp = false;

    if (existsSync(dockerignorePath)) {
      logger.info("Backing up .dockerignore...");
      copyFileSync(dockerignorePath, dockerignoreBackup);
      dockerignoreBackedUp = true;

      // Remove dist/ from .dockerignore temporarily
      const dockerignoreContent = readFileSync(dockerignorePath, "utf-8");
      const modifiedContent = dockerignoreContent
        .split("\n")
        .filter((line) => line.trim() !== "dist/" && line.trim() !== "dist")
        .join("\n");

      writeFileSync(dockerignorePath, modifiedContent);
      logger.info("  ✓ Temporarily allowing dist/ in Docker build");
    }

    try {
      // Build the Docker image
      logger.info("\n🔨 Building Docker image (this may take a while)...");

      const { stdout, stderr } = await execAsync("docker-compose build", {
        cwd: managedDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });

      const buildOutput = stdout + (stderr ? `\n${stderr}` : "");

      // Restore .dockerignore
      if (dockerignoreBackedUp && existsSync(dockerignoreBackup)) {
        logger.info("\nRestoring .dockerignore...");
        copyFileSync(dockerignoreBackup, dockerignorePath);
        unlinkSync(dockerignoreBackup);
        logger.info("  ✓ .dockerignore restored");
      }

      logger.info("\n✅ Docker image built successfully!");
      logger.info("\n📋 Next steps:");
      logger.info(`   1. cd ${directory}`);
      logger.info(`   2. docker-compose up -d`);
      logger.info(`   3. docker-compose logs -f`);

      return {
        success: true,
        data: {
          directory: managedDir,
          buildSuccess: true,
          buildOutput,
        },
        message: "Docker image built successfully",
      };
    } catch (error) {
      // Restore .dockerignore even if build fails
      if (dockerignoreBackedUp && existsSync(dockerignoreBackup)) {
        logger.info("\nRestoring .dockerignore...");
        copyFileSync(dockerignoreBackup, dockerignorePath);
        unlinkSync(dockerignoreBackup);
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const execError = error as { stdout?: string; stderr?: string };
      const buildOutput =
        (execError.stdout || "") + "\n" + (execError.stderr || "");

      logger.error(`Docker build failed: ${errorMessage}`);

      return {
        success: false,
        error: `Docker build failed: ${errorMessage}`,
        data: {
          directory: managedDir,
          buildSuccess: false,
          buildOutput,
        },
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Failed to build Docker image: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to build Docker image: ${errorMessage}`,
    };
  }
}
