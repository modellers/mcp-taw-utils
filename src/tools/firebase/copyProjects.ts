import { createLogger } from "../../utils/logger.js";
import type { ToolResult } from "../../types/index.js";
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const logger = createLogger("tools:firebase:copyProjects");

export interface CopyProjectsOptions {
  sourceServiceAccountPath: string;
  destServiceAccountPath: string;
  collections?: string[]; // Specific collections to copy, or all if not specified
  userIdMapFile?: string; // Path to JSON file with user ID mappings
  dryRun?: boolean;
  verbose?: boolean;
}

export interface CopyProjectsResult {
  collectionsCopied: number;
  documentsCopied: number;
  userIdsReplaced: number;
  collections: string[];
}

// Default collections to copy (from Python script)
const DEFAULT_COLLECTIONS = [
  "tasking",
  "task",
  "project",
  "thread",
  "profile",
];

/**
 * Copy Firestore documents between projects with automatic user ID replacement
 * Converts bin/firebase/copy-projects.py to TypeScript
 */
export async function copyProjects(
  options: CopyProjectsOptions
): Promise<ToolResult<CopyProjectsResult>> {
  const {
    sourceServiceAccountPath,
    destServiceAccountPath,
    collections,
    userIdMapFile,
    dryRun = false,
    verbose = false,
  } = options;

  let sourceApp: admin.app.App | null = null;
  let destApp: admin.app.App | null = null;

  try {
    logger.info("Starting Firebase project copy operation");

    // Load user ID mappings
    const userIdMap = loadUserIdMap(userIdMapFile);
    if (verbose && Object.keys(userIdMap).length > 0) {
      logger.info(`Loaded ${Object.keys(userIdMap).length} user ID mappings`);
    }

    // Resolve paths
    const sourcePath = resolve(process.cwd(), sourceServiceAccountPath);
    const destPath = resolve(process.cwd(), destServiceAccountPath);

    if (!existsSync(sourcePath)) {
      return {
        success: false,
        error: `Source service account not found: ${sourcePath}`,
      };
    }

    if (!existsSync(destPath)) {
      return {
        success: false,
        error: `Destination service account not found: ${destPath}`,
      };
    }

    // Initialize Firebase apps
    const sourceCredential = JSON.parse(readFileSync(sourcePath, "utf-8"));
    const destCredential = JSON.parse(readFileSync(destPath, "utf-8"));

    sourceApp = admin.initializeApp(
      {
        credential: admin.credential.cert(sourceCredential),
        projectId: sourceCredential.project_id,
      },
      "source"
    );

    destApp = admin.initializeApp(
      {
        credential: admin.credential.cert(destCredential),
        projectId: destCredential.project_id,
      },
      "dest"
    );

    const sourceDb = sourceApp.firestore();
    const destDb = destApp.firestore();

    logger.info(`Source project: ${sourceCredential.project_id}`);
    logger.info(`Destination project: ${destCredential.project_id}`);

    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No data will be copied ===");
    }

    // Determine which collections to copy
    const collectionsToProcess = collections || DEFAULT_COLLECTIONS;
    logger.info(`Collections to copy: ${collectionsToProcess.join(", ")}`);

    let totalDocuments = 0;
    let totalReplacements = 0;

    // Process each collection
    for (const collectionName of collectionsToProcess) {
      logger.info(`Processing collection: ${collectionName}`);

      const snapshot = await sourceDb.collection(collectionName).get();
      logger.info(`  Found ${snapshot.size} documents`);

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        // Replace user IDs in document data
        const { data: transformedData, replacements } = replaceUserIds(
          docData,
          userIdMap,
          verbose
        );

        // Transform document ID if it contains user IDs
        const transformedDocId = replaceUserIdInString(doc.id, userIdMap);

        if (verbose && transformedDocId !== doc.id) {
          logger.info(
            `  Document ID transformation: ${doc.id} -> ${transformedDocId}`
          );
        }

        if (!dryRun) {
          // Handle merge strategy for profile collection
          if (collectionName === "profile") {
            const existingDoc = await destDb
              .collection(collectionName)
              .doc(transformedDocId)
              .get();

            if (existingDoc.exists) {
              // Merge activeProjects and project fields
              const existingData = existingDoc.data() || {};
              const transformedDataObj = transformedData as Record<string, any>;
              const mergedData = {
                ...transformedDataObj,
                activeProjects: [
                  ...new Set([
                    ...(existingData.activeProjects || []),
                    ...(transformedDataObj.activeProjects || []),
                  ]),
                ],
                project: {
                  ...(existingData.project || {}),
                  ...(transformedDataObj.project || {}),
                },
              };
              await destDb
                .collection(collectionName)
                .doc(transformedDocId)
                .set(mergedData);
            } else {
              await destDb
                .collection(collectionName)
                .doc(transformedDocId)
                .set(transformedData as admin.firestore.DocumentData);
            }
          } else {
            await destDb
              .collection(collectionName)
              .doc(transformedDocId)
              .set(transformedData as admin.firestore.DocumentData);
          }
        }

        totalDocuments++;
        totalReplacements += replacements;

        if (verbose && replacements > 0) {
          logger.info(`  Replaced ${replacements} user IDs in ${doc.id}`);
        }
      }
    }

    logger.info(`Copy operation completed`);
    logger.info(`  Collections processed: ${collectionsToProcess.length}`);
    logger.info(`  Documents copied: ${totalDocuments}`);
    logger.info(`  User ID replacements: ${totalReplacements}`);

    return {
      success: true,
      data: {
        collectionsCopied: collectionsToProcess.length,
        documentsCopied: totalDocuments,
        userIdsReplaced: totalReplacements,
        collections: collectionsToProcess,
      },
      message: dryRun
        ? `Dry run completed - would copy ${totalDocuments} documents`
        : `Successfully copied ${totalDocuments} documents`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Failed to copy projects: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to copy projects: ${errorMessage}`,
    };
  } finally {
    // Cleanup Firebase apps
    if (sourceApp) {
      await sourceApp.delete();
    }
    if (destApp) {
      await destApp.delete();
    }
  }
}

/**
 * Load user ID mappings from file or environment variable
 */
function loadUserIdMap(userIdMapFile?: string): Record<string, string> {
  // Try environment variable first
  const envMap = process.env.USER_ID_MAP;
  if (envMap) {
    try {
      return JSON.parse(envMap);
    } catch (error) {
      logger.warn("Failed to parse USER_ID_MAP environment variable");
    }
  }

  // Try file
  if (userIdMapFile) {
    const filePath = resolve(process.cwd(), userIdMapFile);
    if (existsSync(filePath)) {
      try {
        return JSON.parse(readFileSync(filePath, "utf-8"));
      } catch (error) {
        logger.warn(`Failed to parse user ID map file: ${filePath}`);
      }
    }
  }

  return {};
}

/**
 * Recursively replace user IDs in document data
 */
function replaceUserIds(
  data: unknown,
  userIdMap: Record<string, string>,
  verbose: boolean
): { data: unknown; replacements: number } {
  let replacements = 0;

  function replace(value: unknown): unknown {
    if (typeof value === "string") {
      const replaced = replaceUserIdInString(value, userIdMap);
      if (replaced !== value) {
        replacements++;
        if (verbose) {
          logger.debug(`  String replacement: ${value} -> ${replaced}`);
        }
      }
      return replaced;
    }

    if (Array.isArray(value)) {
      return value.map((item) => replace(item));
    }

    if (value !== null && typeof value === "object") {
      const obj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const replacedKey = replaceUserIdInString(key, userIdMap);
        if (replacedKey !== key) {
          replacements++;
          if (verbose) {
            logger.debug(`  Key replacement: ${key} -> ${replacedKey}`);
          }
        }
        obj[replacedKey] = replace(val);
      }
      return obj;
    }

    return value;
  }

  return {
    data: replace(data),
    replacements,
  };
}

/**
 * Replace all user IDs in a string
 */
function replaceUserIdInString(
  str: string,
  userIdMap: Record<string, string>
): string {
  let result = str;
  for (const [oldId, newId] of Object.entries(userIdMap)) {
    result = result.replace(new RegExp(oldId, "g"), newId);
  }
  return result;
}
