/**
 * Config Collection Tools
 * Tools for managing Firestore config collection documents
 */

import { getFirestore } from "../../utils/firebase.js";
import { ToolResult, DocumentData, GitConfig } from "../../types/index.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("tools:config");
const COLLECTION_NAME = "config";

/**
 * List all documents in the Firebase 'config' collection
 */
export async function listCollection(): Promise<ToolResult<Array<{ id: string; data: DocumentData }>>> {
  try {
    logger.debug("Listing all documents in config collection");
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION_NAME).get();

    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as DocumentData,
    }));

    logger.info(`Found ${documents.length} documents in config collection`);

    return {
      success: true,
      data: documents,
      message: `Found ${documents.length} documents`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to list collection:", errorMessage);
    return {
      success: false,
      error: `Failed to list collection: ${errorMessage}`,
    };
  }
}

/**
 * Get a document from the 'config' collection by ID
 */
export async function getCollection(
  id: string
): Promise<ToolResult<{ id: string; data: DocumentData } | null>> {
  try {
    logger.debug(`Getting document: ${id}`);
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn(`Document not found: ${id}`);
      return {
        success: true,
        data: null,
        message: `Document with ID '${id}' not found`,
      };
    }

    const data = {
      id: doc.id,
      data: doc.data() as DocumentData,
    };

    logger.info(`Retrieved document: ${id}`);

    return {
      success: true,
      data,
      message: `Document retrieved successfully`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to get document:", errorMessage);
    return {
      success: false,
      error: `Failed to get document: ${errorMessage}`,
    };
  }
}

/**
 * Create or update a document in the 'config' collection
 */
export async function setCollection(
  id: string,
  data: DocumentData,
  merge: boolean = true
): Promise<ToolResult<void>> {
  try {
    logger.debug(`Setting document: ${id} (merge: ${merge})`);
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);

    await docRef.set(data, { merge });

    logger.info(`Document ${merge ? "updated" : "created"}: ${id}`);

    return {
      success: true,
      message: `Document '${id}' successfully ${merge ? "updated" : "created"}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to set document:", errorMessage);
    return {
      success: false,
      error: `Failed to set document: ${errorMessage}`,
    };
  }
}

/**
 * Parse Git URI to extract configuration
 * Supports various Git URI formats:
 * - https://github.com/user/repo.git
 * - git@github.com:user/repo.git
 * - https://github.com/user/repo
 */
export function parseGitUri(uri: string): GitConfig {
  const config: GitConfig = {
    uri,
    type: "git",
    parsedAt: new Date().toISOString(),
  };

  try {
    // Handle SSH format: git@github.com:user/repo.git
    if (uri.startsWith("git@")) {
      const sshMatch = uri.match(/git@([^:]+):(.+?)(\.git)?$/);
      if (sshMatch) {
        config.host = sshMatch[1];
        config.path = sshMatch[2];
        config.protocol = "ssh";
      }
    }
    // Handle HTTPS format: https://github.com/user/repo.git
    else if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const url = new URL(uri);
      config.host = url.hostname;
      config.path = url.pathname.replace(/^\//, "").replace(/\.git$/, "");
      config.protocol = url.protocol.replace(":", "");
    }
    // Handle bare format: github.com/user/repo
    else {
      const parts = uri.split("/");
      if (parts.length >= 2) {
        config.host = parts[0];
        config.path = parts.slice(1).join("/").replace(/\.git$/, "");
        config.protocol = "https";
      }
    }

    // Extract user/org and repo name if possible
    if (config.path) {
      const pathParts = config.path.split("/");
      if (pathParts.length >= 2) {
        config.owner = pathParts[0];
        config.repo = pathParts[1];
      }
    }
  } catch (error) {
    logger.error("Error parsing Git URI:", error);
  }

  return config;
}

/**
 * Extract Git MCP config from a URI
 */
export async function getItemFromGit(uri: string): Promise<ToolResult<GitConfig>> {
  try {
    logger.debug(`Parsing Git URI: ${uri}`);
    const gitConfig = parseGitUri(uri);

    logger.info(`Parsed Git URI successfully: ${gitConfig.owner}/${gitConfig.repo}`);

    return {
      success: true,
      data: gitConfig,
      message: "Git URI parsed successfully",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to extract Git config from URI:", errorMessage);
    return {
      success: false,
      error: `Failed to extract Git config from URI: ${errorMessage}`,
    };
  }
}

/**
 * Update Git MCP config by ID in the 'config' collection
 */
export async function setCollectionItem(
  id: string,
  gitConfig: GitConfig
): Promise<ToolResult<void>> {
  try {
    logger.debug(`Updating Git config for document: ${id}`);
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);

    // Get existing document
    const doc = await docRef.get();

    const updateData = {
      gitConfig,
      updatedAt: new Date().toISOString(),
    };

    if (doc.exists) {
      // Update existing document
      await docRef.update(updateData);
      logger.info(`Updated Git config for existing document: ${id}`);
    } else {
      // Create new document
      await docRef.set({
        ...updateData,
        createdAt: new Date().toISOString(),
      });
      logger.info(`Created new document with Git config: ${id}`);
    }

    return {
      success: true,
      message: `Git MCP config for '${id}' successfully updated`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to update Git config:", errorMessage);
    return {
      success: false,
      error: `Failed to update Git config: ${errorMessage}`,
    };
  }
}
