import { getConfig } from "../../config.js";
import { getFirestore } from "../../utils/firebase.js";
import { createLogger } from "../../utils/logger.js";
import type { ToolResult } from "../../types/index.js";
import admin from "firebase-admin";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { resolve, join, basename } from "path";
import { createReadStream } from "fs";

const logger = createLogger("tools:binaries:upload");

export interface UploadBinariesOptions {
  platform?: "mac" | "windows" | "linux" | "all";
  version?: string;
  directory?: string; // Root directory containing platform builds
  dryRun?: boolean;
}

export interface UploadBinariesResult {
  filesUploaded: number;
  totalSize: number;
  files: Array<{
    platform: string;
    filename: string;
    size: number;
    url: string;
  }>;
}

// Platform-specific patterns
const PLATFORM_PATTERNS = {
  mac: {
    extensions: [".dmg", ".app.zip"],
    folder: "mac",
  },
  windows: {
    extensions: [".exe", ".msi"],
    folder: "win",
  },
  linux: {
    extensions: [".AppImage", ".deb", ".rpm", ".tar.gz"],
    folder: "linux",
  },
};

/**
 * Upload built binaries to Firebase Storage
 * Converts bin/upload-binaries.py to TypeScript
 */
export async function uploadBinaries(
  options: UploadBinariesOptions
): Promise<ToolResult<UploadBinariesResult>> {
  const {
    platform = "all",
    version = "latest",
    directory = "./dist",
    dryRun = false,
  } = options;

  try {
    // Initialize Firebase (needed for Storage)
    getFirestore();

    const config = getConfig();
    logger.info("Starting binary upload to Firebase Storage");

    // Verify directory exists
    const distPath = resolve(process.cwd(), directory);
    if (!existsSync(distPath)) {
      return {
        success: false,
        error: `Build directory not found: ${distPath}`,
      };
    }

    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No files will be uploaded ===");
    }

    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket(config.FIREBASE_STORAGE_BUCKET);
    logger.info(`Target bucket: ${config.FIREBASE_STORAGE_BUCKET}`);
    logger.info(`Version: ${version}`);

    // Determine platforms to process
    const platforms =
      platform === "all"
        ? (Object.keys(PLATFORM_PATTERNS) as Array<keyof typeof PLATFORM_PATTERNS>)
        : [platform as keyof typeof PLATFORM_PATTERNS];

    logger.info(`Platforms: ${platforms.join(", ")}`);

    const uploadedFiles: Array<{
      platform: string;
      filename: string;
      size: number;
      url: string;
    }> = [];
    let totalSize = 0;

    // Process each platform
    for (const plt of platforms) {
      logger.info(`Processing platform: ${plt}`);

      const platformConfig = PLATFORM_PATTERNS[plt];
      const platformPath = join(distPath, platformConfig.folder);

      if (!existsSync(platformPath)) {
        logger.warn(`  Platform directory not found: ${platformPath}`);
        continue;
      }

      // Find matching files
      const files = findBinaryFiles(platformPath, platformConfig.extensions);
      logger.info(`  Found ${files.length} files`);

      for (const filePath of files) {
        const filename = basename(filePath);
        const fileSize = statSync(filePath).size;
        const storagePath = `releases/${version}/${plt}/${filename}`;

        logger.info(`  ${filename} (${formatBytes(fileSize)})`);

        if (!dryRun) {
          // Upload file
          await bucket.upload(filePath, {
            destination: storagePath,
            metadata: {
              metadata: {
                platform: plt,
                version,
                uploadedAt: new Date().toISOString(),
              },
            },
          });

          // Make file publicly accessible
          const file = bucket.file(storagePath);
          await file.makePublic();

          // Get public URL
          const publicUrl = `https://storage.googleapis.com/${config.FIREBASE_STORAGE_BUCKET}/${storagePath}`;

          uploadedFiles.push({
            platform: plt,
            filename,
            size: fileSize,
            url: publicUrl,
          });
        } else {
          uploadedFiles.push({
            platform: plt,
            filename,
            size: fileSize,
            url: `[dry-run] releases/${version}/${plt}/${filename}`,
          });
        }

        totalSize += fileSize;
      }
    }

    logger.info(`Upload operation completed`);
    logger.info(`  Files uploaded: ${uploadedFiles.length}`);
    logger.info(`  Total size: ${formatBytes(totalSize)}`);

    return {
      success: true,
      data: {
        filesUploaded: uploadedFiles.length,
        totalSize,
        files: uploadedFiles,
      },
      message: dryRun
        ? `Dry run completed - would upload ${uploadedFiles.length} files (${formatBytes(totalSize)})`
        : `Successfully uploaded ${uploadedFiles.length} files (${formatBytes(totalSize)})`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Failed to upload binaries: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to upload binaries: ${errorMessage}`,
    };
  }
}

/**
 * Find binary files in directory matching extensions
 */
function findBinaryFiles(directory: string, extensions: string[]): string[] {
  const files: string[] = [];

  function scan(dir: string) {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        for (const ext of extensions) {
          if (item.endsWith(ext)) {
            files.push(fullPath);
            break;
          }
        }
      }
    }
  }

  scan(directory);
  return files;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
